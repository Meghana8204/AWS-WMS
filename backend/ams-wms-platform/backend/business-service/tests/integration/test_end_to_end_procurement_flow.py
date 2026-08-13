"""
Integration test for complete E2E Procurement & Gate Entry pipeline flow:
Material Request -> RFQ -> Supplier Quotation -> Selection -> Finance Approval -> PO -> ASN -> Arrival Notification -> Gate Entry.
"""
from typing import Optional, Sequence
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.database.session import get_uow
from app.main import app
from app.security.dependencies import CurrentUser, get_current_user
from app.modules.masterdata.application.repository import SupplierRepositoryProtocol
from app.modules.masterdata.domain.supplier import Supplier
from app.modules.procurement.application.repository import (
    ArrivalNotificationRepositoryProtocol,
    ASNRepositoryProtocol,
    FinanceApprovalRepositoryProtocol,
    MaterialRequestRepositoryProtocol,
    PurchaseOrderRepository,
    QuotationRepositoryProtocol,
    RFQRepositoryProtocol,
)
from app.modules.procurement.domain.arrival_notification import ArrivalNotification
from app.modules.procurement.domain.finance_approval import FinanceApproval
from app.modules.procurement.domain.material_request import MaterialRequest
from app.modules.procurement.domain.purchase_order import PurchaseOrder
from app.modules.procurement.domain.rfq import RequestForQuotation
from app.modules.procurement.domain.supplier_asn import SupplierASN
from app.modules.procurement.domain.supplier_quotation import SupplierQuotation
from app.modules.procurement.domain.value_objects import PurchaseOrderId
from app.modules.gate.application.repository import GateEntryRepositoryProtocol
from app.modules.gate.domain.gate_entry import GateEntry

mock_user = CurrentUser(
    subject="user-admin",
    username="admin_procurement",
    roles=["ADMIN"],
    permissions=["procurement:read", "procurement:write", "suppliers:read", "suppliers:write", "gate:read", "gate:write"],
    raw_claims={},
)


# In-Memory Repositories for E2E testing
class InMemorySupplierRepo(SupplierRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, supplier: Supplier) -> Supplier: self.data[supplier.id] = supplier; return supplier
    async def get_by_id(self, supplier_id: str) -> Optional[Supplier]: return self.data.get(supplier_id)
    async def get_by_code(self, supplier_code: str) -> Optional[Supplier]: return next((s for s in self.data.values() if s.supplier_code == supplier_code), None)
    async def list_all(self, category=None, status=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


class InMemoryMaterialRequestRepo(MaterialRequestRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, request: MaterialRequest) -> MaterialRequest: self.data[request.id] = request; return request
    async def get_by_id(self, request_id: str) -> Optional[MaterialRequest]: return self.data.get(request_id)
    async def list_all(self, status=None, warehouse_id=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


class InMemoryRFQRepo(RFQRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, rfq: RequestForQuotation) -> RequestForQuotation: self.data[rfq.id] = rfq; return rfq
    async def get_by_id(self, rfq_id: str) -> Optional[RequestForQuotation]: return self.data.get(rfq_id)
    async def list_all(self, status=None, warehouse_id=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


class InMemoryQuotationRepo(QuotationRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, quotation: SupplierQuotation) -> SupplierQuotation: self.data[quotation.id] = quotation; return quotation
    async def get_by_id(self, quotation_id: str) -> Optional[SupplierQuotation]: return self.data.get(quotation_id)
    async def list_by_rfq(self, rfq_id: str) -> list[SupplierQuotation]: return [q for q in self.data.values() if q.rfq_id == rfq_id]


class InMemoryFinanceApprovalRepo(FinanceApprovalRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, approval: FinanceApproval) -> FinanceApproval: self.data[approval.id] = approval; return approval
    async def get_by_id(self, approval_id: str) -> Optional[FinanceApproval]: return self.data.get(approval_id)
    async def get_by_po_id(self, po_id: str) -> Optional[FinanceApproval]: return next((fa for fa in self.data.values() if fa.po_id == po_id), None)
    async def list_all(self, status=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


class InMemoryPurchaseOrderRepo(PurchaseOrderRepository):
    def __init__(self): self.data = {}
    async def save(self, purchase_order: PurchaseOrder) -> None: self.data[purchase_order.id.value] = purchase_order
    async def find_by_id(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrder]: return self.data.get(po_id.value)
    async def find_by_po_number(self, po_number: str) -> Optional[PurchaseOrder]: return next((p for p in self.data.values() if p.po_number == po_number), None)
    async def list_all(self, status=None, supplier_id=None, search_query=None, limit=50, offset=0):
        res = list(self.data.values())
        return res[offset:offset+limit]
    async def count(self, status=None, supplier_id=None, search_query=None) -> int: return len(self.data)


class InMemoryASNRepo(ASNRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, asn: SupplierASN) -> SupplierASN: self.data[asn.id] = asn; return asn
    async def get_by_id(self, asn_id: str) -> Optional[SupplierASN]: return self.data.get(asn_id)
    async def get_by_vehicle(self, vehicle_number: str) -> Optional[SupplierASN]: return next((a for a in self.data.values() if a.vehicle_number == vehicle_number.upper()), None)
    async def get_by_po_id(self, po_id: str) -> Optional[SupplierASN]: return next((a for a in self.data.values() if a.po_id == po_id), None)
    async def list_all(self, status=None, warehouse_id=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


class InMemoryArrivalNotificationRepo(ArrivalNotificationRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, notification: ArrivalNotification) -> ArrivalNotification: self.data[notification.id] = notification; return notification
    async def get_by_id(self, notification_id: str) -> Optional[ArrivalNotification]: return self.data.get(notification_id)
    async def list_all(self, warehouse_id=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


class InMemoryGateEntryRepo(GateEntryRepositoryProtocol):
    def __init__(self): self.data = {}
    async def save(self, gate_entry: GateEntry) -> GateEntry: self.data[gate_entry.id] = gate_entry; return gate_entry
    async def get_by_id(self, gate_entry_id: str) -> Optional[GateEntry]: return self.data.get(gate_entry_id)
    async def get_by_vehicle(self, vehicle_number: str) -> Optional[GateEntry]: return next((g for g in self.data.values() if g.vehicle_number == vehicle_number.upper()), None)
    async def list_all(self, status=None, warehouse_id=None, skip=0, limit=50):
        res = list(self.data.values())
        return res[skip:skip+limit], len(res)


@pytest.fixture
def client():
    supp_repo = InMemorySupplierRepo()
    mr_repo = InMemoryMaterialRequestRepo()
    rfq_repo = InMemoryRFQRepo()
    quo_repo = InMemoryQuotationRepo()
    fa_repo = InMemoryFinanceApprovalRepo()
    po_repo = InMemoryPurchaseOrderRepo()
    asn_repo = InMemoryASNRepo()
    an_repo = InMemoryArrivalNotificationRepo()
    gate_repo = InMemoryGateEntryRepo()

    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch("app.modules.masterdata.infrastructure.api.router.SQLAlchemySupplierRepository", side_effect=lambda db: supp_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyMaterialRequestRepository", side_effect=lambda db: mr_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyRFQRepository", side_effect=lambda db: rfq_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyQuotationRepository", side_effect=lambda db: quo_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyFinanceApprovalRepository", side_effect=lambda db: fa_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyPurchaseOrderRepository", side_effect=lambda db: po_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyASNRepository", side_effect=lambda db: asn_repo), \
         patch("app.modules.procurement.infrastructure.api.router.SqlAlchemyArrivalNotificationRepository", side_effect=lambda db: an_repo), \
         patch("app.modules.gate.infrastructure.api.router.SQLAlchemyGateEntryRepository", side_effect=lambda db: gate_repo), \
         patch("app.modules.gate.infrastructure.api.router.SqlAlchemyASNRepository", side_effect=lambda db: asn_repo), \
         patch("app.main.start_producer", new_callable=AsyncMock), \
         patch("app.main.stop_producer", new_callable=AsyncMock), \
         patch("app.main.start_notification_consumer", new_callable=AsyncMock), \
         patch("app.main.relay_once", new_callable=AsyncMock), \
         patch("app.main.scheduler.start", return_value=None), \
         patch("app.main.scheduler.shutdown", return_value=None):
        with TestClient(app, raise_server_exceptions=True) as tc:
            yield tc

    app.dependency_overrides.clear()


def test_complete_procurement_e2e_flow(client):
    # Step 1: Create Supplier
    supp_resp = client.post("/api/v1/suppliers", json={
        "supplier_code": "SUPP-VERTEX",
        "supplier_name": "Vertex Metals Corp",
        "category": "Raw Materials",
        "email": "sales@vertexmetals.com",
    })
    assert supp_resp.status_code == 201, supp_resp.text
    supplier_id = supp_resp.json()["id"]

    # Step 2: Create Material Request (PR)
    mr_resp = client.post("/api/v1/procurement/material-requests", json={
        "warehouse_id": "WH-MAIN",
        "department": "Production",
        "requested_by": "Operator Sam",
        "target_delivery_date": "2026-09-10",
        "items": [
            {
                "material_code": "COPPER-ROD-01",
                "material_name": "Copper Rod 10mm",
                "requested_qty": 100,
                "category": "Raw Material",
                "unit_of_measure": "KG",
                "estimated_unit_cost": 8.50,
            }
        ],
        "priority": "HIGH",
    })
    assert mr_resp.status_code == 201, mr_resp.text
    mr_id = mr_resp.json()["id"]

    # Submit & Approve PR
    client.post(f"/api/v1/procurement/material-requests/{mr_id}/submit")
    client.post(f"/api/v1/procurement/material-requests/{mr_id}/approve")

    # Step 3: Create & Publish RFQ
    rfq_resp = client.post("/api/v1/procurement/rfqs", json={
        "title": "RFQ for Q3 Copper Supply",
        "warehouse_id": "WH-MAIN",
        "due_date": "2026-08-30",
        "material_request_ids": [mr_id],
        "items": [
            {
                "material_code": "COPPER-ROD-01",
                "material_name": "Copper Rod 10mm",
                "quantity": 100,
                "unit_of_measure": "KG",
            }
        ],
        "invited_suppliers": [
            {
                "supplier_id": supplier_id,
                "supplier_code": "SUPP-VERTEX",
                "supplier_name": "Vertex Metals Corp",
                "email": "sales@vertexmetals.com",
            }
        ],
    })
    assert rfq_resp.status_code == 201, rfq_resp.text
    rfq_id = rfq_resp.json()["id"]

    client.post(f"/api/v1/procurement/rfqs/{rfq_id}/publish")

    # Step 3b: Send RFQ Emails to Suppliers
    email_resp = client.post(f"/api/v1/procurement/rfqs/{rfq_id}/send-emails")
    assert email_resp.status_code == 200
    assert email_resp.json()["total_notifications_sent"] == 1

    # Step 4: Submit Supplier Quotation
    quo_resp = client.post("/api/v1/procurement/quotations", json={
        "rfq_id": rfq_id,
        "supplier_id": supplier_id,
        "supplier_code": "SUPP-VERTEX",
        "supplier_name": "Vertex Metals Corp",
        "valid_until": "2026-09-30",
        "items": [
            {
                "material_code": "COPPER-ROD-01",
                "material_name": "Copper Rod 10mm",
                "offered_qty": 100,
                "unit_price": 8.00,
                "tax_rate": 0.18,
                "discount_percent": 2.0,
            }
        ],
        "payment_terms": "NET30",
        "delivery_lead_time_days": 5,
    })
    assert quo_resp.status_code == 201, quo_resp.text
    quo_id = quo_resp.json()["id"]

    # Step 4b: Get Quotation Comparison Matrix
    matrix_resp = client.get(f"/api/v1/procurement/rfqs/{rfq_id}/comparison-matrix")
    assert matrix_resp.status_code == 200
    assert matrix_resp.json()["total_quotations"] == 1
    assert matrix_resp.json()["best_recommendation_supplier_id"] == supplier_id

    # Step 5: Select Quotation & Trigger Finance Approval / Draft PO
    sel_resp = client.post(f"/api/v1/procurement/rfqs/{rfq_id}/quotations/{quo_id}/select", json={
        "selected_by": "Procurement Manager Bob",
        "selection_notes": "Best price and fast delivery lead time",
    })
    assert sel_resp.status_code == 200, sel_resp.text
    po_data = sel_resp.json()
    po_id = po_data["id"]
    po_number = po_data["po_number"]

    # Step 5b: Send PO Email to Supplier with ASN Link
    po_email_resp = client.post(f"/api/v1/procurement/purchase-orders/{po_id}/send-supplier-email")
    assert po_email_resp.status_code == 200
    assert "asn_link" in po_email_resp.json()["details"]

    # Step 6: Download PO PDF
    pdf_resp = client.get(f"/api/v1/procurement/purchase-orders/{po_id}/pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"

    # Step 7: Supplier Submits ASN
    asn_resp = client.post("/api/v1/procurement/asns", json={
        "po_id": po_id,
        "po_number": po_number,
        "supplier_id": supplier_id,
        "supplier_name": "Vertex Metals Corp",
        "warehouse_id": "WH-MAIN",
        "expected_arrival_date": "2026-09-02",
        "transporter_name": "BlueDart Express",
        "tracking_number": "BD-889900",
        "vehicle_number": "KA-01-MJ-5555",
        "items": [
            {
                "po_item_id": po_data["items"][0]["id"],
                "material_code": "COPPER-ROD-01",
                "material_name": "Copper Rod 10mm",
                "ordered_qty": 100,
                "shipped_qty": 100,
                "batch_number": "BATCH-COP-001",
            }
        ],
        "driver_name": "Rajesh Kumar",
        "driver_phone": "+919876543210",
    })
    assert asn_resp.status_code == 201, asn_resp.text
    asn_data = asn_resp.json()
    asn_id = asn_data["id"]

    # Step 8: Verify Arrival Notification
    an_resp = client.get("/api/v1/procurement/arrival-notifications")
    assert an_resp.status_code == 200
    an_list = an_resp.json()
    assert len(an_list) >= 1
    assert an_list[0]["vehicle_number"] == "KA-01-MJ-5555"

    # Step 9: Gate Security Searches ASN by Vehicle Registration
    gate_search_resp = client.get("/api/v1/gate/asns/search?query=KA-01-MJ-5555")
    assert gate_search_resp.status_code == 200
    assert gate_search_resp.json()["id"] == asn_id

    # Step 10: Gate Check-In & Dock Operations
    checkin_resp = client.post("/api/v1/gate/entries", json={
        "warehouse_id": "WH-MAIN",
        "vehicle_number": "KA-01-MJ-5555",
        "driver_name": "Rajesh Kumar",
        "driver_phone": "+919876543210",
        "asn_id": asn_id,
        "security_officer_id": "OFFICER-JOHN",
        "verification_notes": "Identity verified",
    })
    assert checkin_resp.status_code == 201, checkin_resp.text
    ge_data = checkin_resp.json()
    ge_id = ge_data["id"]

    # Assign Dock
    dock_resp = client.post(f"/api/v1/gate/entries/{ge_id}/assign-dock", json={"dock_id": "DOCK-01"})
    assert dock_resp.status_code == 200
    assert dock_resp.json()["assigned_dock_id"] == "DOCK-01"

    # Record Weighbridge
    weigh_resp = client.post(f"/api/v1/gate/entries/{ge_id}/weighbridge", json={"gross_weight_kg": 14500.0, "tare_weight_kg": 4500.0})
    assert weigh_resp.status_code == 200
    assert float(weigh_resp.json()["net_weight_kg"]) == 10000.0

    # Gate Check-Out
    checkout_resp = client.post(f"/api/v1/gate/entries/{ge_id}/check-out")
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["status"] == "CHECKED_OUT"
