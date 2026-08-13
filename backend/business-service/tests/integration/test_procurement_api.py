"""
Integration tests for procurement Purchase Order API endpoints.
Uses dependency overrides for auth and unit of work (in-memory repository).
"""
import io
from typing import Optional, Sequence
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from fastapi.testclient import TestClient
import pytest

from app.database import get_db
from app.main import app
from app.modules.procurement.application.repository import PurchaseOrderRepository
from app.modules.procurement.domain.purchase_order import PurchaseOrder
from app.modules.procurement.domain.value_objects import PurchaseOrderId
from app.security.dependencies import CurrentUser, get_current_user

# Mock authentication dependency
mock_user = CurrentUser(
    subject="user-123",
    username="john_buyer",
    roles=["ADMIN"],
    permissions=["procurement:read", "procurement:write"],
    raw_claims={},
)


class InMemoryPurchaseOrderRepository(PurchaseOrderRepository):
    def __init__(self) -> None:
        self.orders: dict[uuid.UUID, PurchaseOrder] = {}

    async def save(self, purchase_order: PurchaseOrder) -> None:
        self.orders[purchase_order.id.value] = purchase_order
        purchase_order.recorded_events.clear()

    async def find_by_id(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrder]:
        return self.orders.get(po_id.value)

    async def find_by_po_number(self, po_number: str) -> Optional[PurchaseOrder]:
        for po in self.orders.values():
            if po.po_number == po_number:
                return po
        return None

    async def list_all(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[PurchaseOrder]:
        result = list(self.orders.values())
        if status:
            result = [po for po in result if po.status.value == status]
        if supplier_id:
            result = [po for po in result if po.supplier_id == supplier_id]
        if search_query:
            q = search_query.lower()
            result = [
                po for po in result
                if q in po.po_number.lower()
                or (po.supplier_info.supplier_name and q in po.supplier_info.supplier_name.lower())
            ]
        return result[offset : offset + limit]

    async def count(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> int:
        res = await self.list_all(status=status, supplier_id=supplier_id, search_query=search_query, limit=999999)
        return len(res)


@pytest.fixture
def repo():
    return InMemoryPurchaseOrderRepository()


@pytest.fixture
def client(repo):
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Patch SqlAlchemyPurchaseOrderRepository and background services for standalone testing
    with patch(
        "app.modules.procurement.infrastructure.api.router.SqlAlchemyPurchaseOrderRepository",
        side_effect=lambda session: repo,
    ), patch("app.main.start_producer", new_callable=AsyncMock), patch(
        "app.main.stop_producer", new_callable=AsyncMock
    ), patch(
        "app.main.start_notification_consumer", new_callable=AsyncMock
    ), patch(
        "app.main.relay_once", new_callable=AsyncMock
    ), patch(
        "app.main.scheduler.start", return_value=None
    ), patch(
        "app.main.scheduler.shutdown", return_value=None
    ):
        with TestClient(app, raise_server_exceptions=True) as test_client:
            yield test_client

    app.dependency_overrides.clear()


def test_create_purchase_order_endpoint(client):
    payload = {
        "supplier_id": "SUPP-999",
        "warehouse_id": "WH-NORTH",
        "expected_delivery_date": "2026-09-01",
        "po_number": "PO-TEST-001",
        "po_date": "2026-08-10",
        "department": "Procurement Dept",
        "buyer": "John Buyer",
        "supplier_info": {
            "supplier_code": "SUPP-999",
            "supplier_name": "Global Traders Ltd",
            "contact_person": "Michael Scott",
            "phone": "+1987654321",
            "email": "michael@globaltraders.com",
            "gst_number": "29BBBBB1111B2Z2",
            "supplier_address": "789 Logistics Way, Industrial Zone",
        },
        "delivery_details": {
            "delivery_warehouse": "WH-NORTH",
            "delivery_address": "Gate 3, North Hub",
            "expected_delivery_date": "2026-09-01",
            "transporter": "FastTrack Freight",
        },
        "items": [
            {
                "material_code": "MAT-VALVE-01",
                "material_name": "Control Valve 2-inch",
                "category": "Plumbing",
                "quantity": 20,
                "unit_price": 500.0,
            },
            {
                "material_code": "MAT-PIPE-05",
                "material_name": "PVC Pipe 10m",
                "category": "Plumbing",
                "quantity": 50,
                "unit_price": 100.0,
            },
        ],
        "tax_rate": 0.18,
    }

    response = client.post("/api/v1/procurement/purchase-orders", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["po_number"] == "PO-TEST-001"
    assert data["status"] == "CREATED"
    assert data["supplier_id"] == "SUPP-999"
    assert data["supplier_info"]["supplier_name"] == "Global Traders Ltd"
    assert len(data["items"]) == 2
    assert data["summary"]["total_items"] == 2
    assert float(data["summary"]["total_quantity"]) == 70.0
    assert float(data["summary"]["subtotal"]) == 15000.0
    assert float(data["summary"]["tax_amount"]) == 2700.0
    assert float(data["summary"]["grand_total"]) == 17700.0

    po_id = data["id"]

    # Fetch PO by ID
    get_resp = client.get(f"/api/v1/procurement/purchase-orders/{po_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["po_number"] == "PO-TEST-001"

    # Download PDF endpoint
    pdf_resp = client.get(f"/api/v1/procurement/purchase-orders/{po_id}/pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"


def test_save_draft_purchase_order_endpoint(client):
    payload = {
        "supplier_id": "SUPP-DRAFT",
        "po_number": "PO-DRAFT-99",
        "department": "R&D",
        "supplier_info": {
            "supplier_name": "Draft Supplier",
        },
        "items": [],
    }

    response = client.post("/api/v1/procurement/purchase-orders/draft", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["po_number"] == "PO-DRAFT-99"
    assert data["status"] == "DRAFT"
    assert data["supplier_info"]["supplier_name"] == "Draft Supplier"
