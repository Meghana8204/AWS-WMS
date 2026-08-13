"""
Unit tests for entire Procurement & Gate Entry pipeline domain aggregates.
"""
from datetime import date, datetime
from decimal import Decimal
import pytest

from app.modules.masterdata.domain.supplier import Supplier, SupplierStatus
from app.modules.procurement.domain.material_request import MaterialRequest, MaterialRequestItem, MaterialRequestStatus
from app.modules.procurement.domain.rfq import RequestForQuotation, RFQItem, RFQStatus, RFQSupplier
from app.modules.procurement.domain.supplier_quotation import SupplierQuotation, QuotationItem, QuotationStatus
from app.modules.procurement.domain.finance_approval import FinanceApproval, FinanceApprovalStatus, FINANCE_APPROVAL_THRESHOLD
from app.modules.procurement.domain.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.modules.procurement.domain.supplier_asn import SupplierASN, ASNItem, ASNStatus
from app.modules.procurement.domain.arrival_notification import ArrivalNotification, ArrivalNotificationStatus
from app.modules.gate.domain.gate_entry import GateEntry, GateEntryStatus, WeighbridgeData


def test_supplier_aggregate():
    supp = Supplier.create(
        supplier_code="SUPP-500",
        supplier_name="Apex Logistics Ltd",
        category="Transport",
        email="apex@logistics.com",
    )
    assert supp.status == SupplierStatus.ACTIVE
    assert supp.rating.overall_rating == 5.0

    supp.update_rating(on_time_delivery_rate=90.0, quality_score=4.0)
    assert supp.rating.overall_rating == 4.25


def test_material_request_pipeline():
    item = MaterialRequestItem.create(
        material_code="MAT-STEEL-01",
        material_name="Structural Steel Beams",
        requested_qty=50,
        estimated_unit_cost=120.0,
    )
    req = MaterialRequest.create(
        warehouse_id="WH-CENTRAL",
        department="Manufacturing",
        requested_by="Alice Engineer",
        target_delivery_date=date(2026, 9, 1),
        items=[item],
    )
    assert req.status == MaterialRequestStatus.DRAFT
    assert req.total_estimated_cost == Decimal("6000.00")

    req.submit()
    assert req.status == MaterialRequestStatus.SUBMITTED

    req.approve()
    assert req.status == MaterialRequestStatus.APPROVED

    req.mark_in_rfq()
    assert req.status == MaterialRequestStatus.IN_RFQ


def test_rfq_and_quotation_pipeline():
    rfq_item = RFQItem.create(material_code="MAT-STEEL-01", material_name="Structural Steel Beams", quantity=50)
    invited_supp = RFQSupplier(supplier_id="SUPP-500", supplier_code="SUPP-500", supplier_name="Apex Logistics Ltd")

    rfq = RequestForQuotation.create(
        title="RFQ for Manufacturing Materials Q3",
        warehouse_id="WH-CENTRAL",
        due_date=date(2026, 8, 25),
        items=[rfq_item],
        invited_suppliers=[invited_supp],
    )
    assert rfq.status == RFQStatus.DRAFT

    rfq.publish()
    assert rfq.status == RFQStatus.PUBLISHED

    quo_item = QuotationItem.create(
        material_code="MAT-STEEL-01",
        material_name="Structural Steel Beams",
        offered_qty=50,
        unit_price=110.0,
        discount_percent=5.0,
    )
    quo = SupplierQuotation.create(
        rfq_id=rfq.id,
        supplier_id="SUPP-500",
        supplier_code="SUPP-500",
        supplier_name="Apex Logistics Ltd",
        valid_until=date(2026, 9, 15),
        items=[quo_item],
    )
    assert quo.status == QuotationStatus.SUBMITTED
    # subtotal = 50 * 110 - 5% = 5500 - 275 = 5225.0
    assert quo.subtotal == Decimal("5225.00")

    quo.mark_selected()
    assert quo.status == QuotationStatus.SELECTED


def test_finance_approval_rules():
    fa_low = FinanceApproval.create(
        po_id="PO-1001",
        po_number="PO-20260812-0001",
        total_amount=25000.00,
        requested_by="Buyer1",
    )
    assert not fa_low.requires_cfo_approval

    fa_high = FinanceApproval.create(
        po_id="PO-1002",
        po_number="PO-20260812-0002",
        total_amount=75000.00,
        requested_by="Buyer1",
    )
    assert fa_high.requires_cfo_approval

    fa_high.approve(approver_id="FIN-DIRECTOR", approver_name="Jane CFO", notes="Approved high-value PO")
    assert fa_high.status == FinanceApprovalStatus.APPROVED


def test_asn_arrival_and_gate_entry_pipeline():
    asn_item = ASNItem.create(
        po_item_id="POI-1",
        material_code="MAT-STEEL-01",
        material_name="Structural Steel Beams",
        ordered_qty=50,
        shipped_qty=50,
        batch_number="BATCH-2026-X",
    )
    asn = SupplierASN.create(
        po_id="PO-1001",
        po_number="PO-20260812-0001",
        supplier_id="SUPP-500",
        supplier_name="Apex Logistics Ltd",
        warehouse_id="WH-CENTRAL",
        expected_arrival_date=date.today(),
        transporter_name="Fast Logistics",
        tracking_number="TRK-998877",
        vehicle_number="MH-12-XX-9999",
        items=[asn_item],
    )
    assert asn.status == ASNStatus.SUBMITTED
    assert asn.vehicle_number == "MH-12-XX-9999"

    gate_entry = GateEntry.create_check_in(
        warehouse_id="WH-CENTRAL",
        vehicle_number="MH-12-XX-9999",
        supplier_name="Apex Logistics Ltd",
        driver_name="Michael Driver",
        driver_phone="+1555112233",
        asn_id=asn.id,
        po_id=asn.po_id,
    )
    assert gate_entry.status == GateEntryStatus.CHECKED_IN

    gate_entry.assign_dock("DOCK-02")
    assert gate_entry.status == GateEntryStatus.DOCK_ASSIGNED
    assert gate_entry.assigned_dock_id == "DOCK-02"

    gate_entry.record_weighbridge(gross_weight_kg=15000, tare_weight_kg=4000)
    assert gate_entry.weighbridge.net_weight_kg == Decimal("11000.00")

    gate_entry.check_out()
    assert gate_entry.status == GateEntryStatus.CHECKED_OUT
    assert gate_entry.exit_time is not None


def test_finance_rejection_and_resubmission():
    po = PurchaseOrder.create(
        po_number="PO-REJECT-001",
        supplier_id="SUPP-99",
        warehouse_id="WH-1",
        expected_delivery_date=date.today(),
        items=[
            PurchaseOrderItem.create("M-1", "Material 1", "Cat", 100, Decimal("600.00"))
        ],
        tax_rate=Decimal("0.18"),
    )
    po.submit_for_finance_approval("FA-100")
    assert po.status == PurchaseOrderStatus.PENDING_FINANCE_APPROVAL

    po.finance_reject()
    assert po.status == PurchaseOrderStatus.FINANCE_REJECTED

    # Resubmit with lower quantity
    revised_items = [PurchaseOrderItem.create("M-1", "Material 1", "Cat", 50, Decimal("600.00"))]
    po.resubmit_for_finance_approval("FA-101", items=revised_items)
    assert po.status == PurchaseOrderStatus.PENDING_FINANCE_APPROVAL
    assert po.subtotal == Decimal("30000.00")
