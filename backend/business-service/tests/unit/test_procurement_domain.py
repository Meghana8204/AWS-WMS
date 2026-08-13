"""
Unit tests for procurement domain aggregate.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.modules.procurement.domain import (
    AttachmentCategory,
    DeliveryDetails,
    PurchaseOrder,
    PurchaseOrderAttachment,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    PurchaseOrderValidationError,
    SupplierInfo,
)


def test_create_purchase_order_success():
    items = [
        PurchaseOrderItem.create(material_code="MAT-001", material_name="Steel Pipe", category="Raw Material", quantity=10, unit_price=150.0),
        PurchaseOrderItem.create(material_code="MAT-002", material_name="Copper Rod", category="Raw Material", quantity=5, unit_price=200.0),
    ]
    po = PurchaseOrder.create(
        supplier_id="SUPP-101",
        warehouse_id="WH-MAIN",
        expected_delivery_date=date(2026, 8, 20),
        department="Engineering",
        buyer="John Doe",
        supplier_info=SupplierInfo(
            supplier_code="SUPP-101",
            supplier_name="Acme Corp",
            contact_person="Alice Smith",
            phone="+1234567890",
            email="alice@acme.com",
            gst_number="27AAAAA0000A1Z5",
            supplier_address="123 Industrial Park, City",
        ),
        delivery_details=DeliveryDetails(
            delivery_warehouse="WH-MAIN",
            delivery_address="456 Receiving Dock, City",
            expected_delivery_date=date(2026, 8, 20),
            transporter="Express Logistics",
        ),
        items=items,
    )

    assert po.status == PurchaseOrderStatus.CREATED
    assert po.supplier_id == "SUPP-101"
    assert po.warehouse_id == "WH-MAIN"
    assert po.total_items == 2
    assert po.total_quantity == Decimal("15.0")
    assert po.subtotal == Decimal("2500.0")  # (10*150) + (5*200) = 1500 + 1000 = 2500
    assert po.tax_amount == Decimal("450.00")  # 2500 * 0.18 = 450
    assert po.grand_total == Decimal("2950.00")
    assert len(po.recorded_events) == 1


def test_create_purchase_order_validation_errors():
    with pytest.raises(PurchaseOrderValidationError, match="Supplier is required"):
        PurchaseOrder.create(supplier_id="", warehouse_id="WH-1", expected_delivery_date=date.today())

    with pytest.raises(PurchaseOrderValidationError, match="Warehouse is required"):
        PurchaseOrder.create(supplier_id="SUP-1", warehouse_id=" ", expected_delivery_date=date.today())

    with pytest.raises(PurchaseOrderValidationError, match="At least one order item is required"):
        PurchaseOrder.create(supplier_id="SUP-1", warehouse_id="WH-1", expected_delivery_date=date.today(), items=[])

    with pytest.raises(PurchaseOrderValidationError, match="must be greater than zero"):
        items = [PurchaseOrderItem.create(material_code="M1", quantity=0)]
        PurchaseOrder.create(supplier_id="SUP-1", warehouse_id="WH-1", expected_delivery_date=date.today(), items=items)


def test_save_draft_purchase_order_relaxed_validation():
    po = PurchaseOrder.save_draft(
        supplier_id="SUPP-101",
        items=[PurchaseOrderItem.create(material_code="MAT-001", quantity=0)],
    )

    assert po.status == PurchaseOrderStatus.DRAFT
    assert po.supplier_id == "SUPP-101"
    assert po.warehouse_id is None
    assert po.total_items == 1


def test_add_attachment():
    po = PurchaseOrder.save_draft(supplier_id="SUPP-101")
    attachment = PurchaseOrderAttachment.create(
        filename="quotation.pdf",
        file_type="application/pdf",
        file_path="/storage/quotations/quotation.pdf",
        file_size_bytes=2048576,
        category=AttachmentCategory.QUOTATION,
    )
    po.add_attachment(attachment)

    assert len(po.attachments) == 1
    assert po.attachments[0].filename == "quotation.pdf"
    assert po.attachments[0].category == AttachmentCategory.QUOTATION
