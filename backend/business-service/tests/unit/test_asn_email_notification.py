"""Unit tests for Advance Shipment Notice (ASN) email generation and dispatch logic."""

import uuid
from datetime import datetime, date
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

from app.modules.procurement.infrastructure.persistence.models import (
    AsnModel,
    AsnLineModel,
    PurchaseOrderModel,
)
from app.modules.procurement.infrastructure.api.router import (
    _dispatch_asn_email,
)
from app.config.settings import Settings


def create_fake_asn():
    asn_id = uuid.uuid4()
    line1 = AsnLineModel(
        id=uuid.uuid4(),
        asn_id=asn_id,
        item_code="MAT-0019",
        material_name="Steel Rod 10mm",
        shipped_quantity=Decimal("150.0000"),
        uom="PCS",
    )
    line2 = AsnLineModel(
        id=uuid.uuid4(),
        asn_id=asn_id,
        item_code="MAT-0020",
        material_name="Aluminium Sheet",
        shipped_quantity=Decimal("50.0000"),
        uom="MTR",
    )
    asn = AsnModel(
        id=asn_id,
        asn_number="ASN-2026-0008",
        po_id=str(uuid.uuid4()),
        po_number="PO-2026-0009",
        vehicle_number="AP-13-N-0001",
        expected_arrival_at=datetime(2026, 9, 5, 14, 30),
        shipment_date=date(2026, 9, 3),
        driver_name="Rajesh Kumar",
        driver_contact="+91 9876543210",
        transporter="FastLogistics Ltd",
        number_of_packages=10,
        package_type="Wooden Crates",
        status="SUBMITTED",
    )
    asn.lines = [line1, line2]
    asn.documents = []
    return asn


def test_dispatch_asn_email_content_and_recipient():
    asn = create_fake_asn()
    po = PurchaseOrderModel(
        id=uuid.UUID(asn.po_id),
        po_number="PO-2026-0009",
        supplier_name="obys",
        delivery_warehouse_name="Main Warehouse",
        supplier_email="supplier@example.com",
    )

    bg_tasks = MagicMock()

    custom_settings = Settings(
        procurement_email="procurement-team@nexuswms.com",
        warehouse_email="warehouse-ops@nexuswms.com",
        email_host_user="obaiahkade12@gmail.com",
        email_host_password="test_password",
    )

    with patch("app.modules.procurement.infrastructure.api.router.get_settings", return_value=custom_settings):
        _dispatch_asn_email(
            asn=asn,
            po_obj=po,
            supplier_name="obys",
            warehouse_name="Main Warehouse",
            background_tasks=bg_tasks,
            is_resubmit=False,
        )

    # Verify background task was queued
    assert bg_tasks.add_task.called
    args = bg_tasks.add_task.call_args[0]
    func, to_email, subject, body, html_body, context = args

    # Check recipient: should prefer warehouse_email or procurement_email, not supplier
    assert to_email == "warehouse-ops@nexuswms.com"
    assert to_email != po.supplier_email

    # Check Subject
    assert subject == "NEXUSWMS · ADVANCE SHIPMENT NOTICE – ASN-2026-0008"

    # Check Plain text body fields
    assert "ASN Number: ASN-2026-0008" in body
    assert "PO Number: PO-2026-0009" in body
    assert "Supplier: obys" in body
    assert "Warehouse: Main Warehouse" in body
    assert "Vehicle: AP-13-N-0001" in body
    assert "Driver: Rajesh Kumar" in body
    assert "Driver Phone: +91 9876543210" in body
    assert "MAT-0019" in body
    assert "Steel Rod 10mm" in body
    assert "MAT-0020" in body
    assert "Aluminium Sheet" in body

    # Check HTML body contains key details
    assert "ASN-2026-0008" in html_body
    assert "PO-2026-0009" in html_body
    assert "obys" in html_body
    assert "Main Warehouse" in html_body
    assert "AP-13-N-0001" in html_body
    assert "Rajesh Kumar" in html_body


def test_dispatch_asn_email_guards_against_supplier_email_recipient():
    asn = create_fake_asn()
    po = PurchaseOrderModel(
        id=uuid.UUID(asn.po_id),
        po_number="PO-2026-0009",
        supplier_name="obys",
        delivery_warehouse_name="Main Warehouse",
        supplier_email="supplier@example.com",
    )

    bg_tasks = MagicMock()

    # In case settings has supplier email as procurement email
    custom_settings = Settings(
        procurement_email="supplier@example.com",
        warehouse_email="supplier@example.com",
        email_host_user="supplier@example.com",
    )

    with patch("app.modules.procurement.infrastructure.api.router.get_settings", return_value=custom_settings):
        _dispatch_asn_email(
            asn=asn,
            po_obj=po,
            supplier_name="obys",
            warehouse_name="Main Warehouse",
            background_tasks=bg_tasks,
            is_resubmit=False,
        )

    # Should NOT send email to supplier when warehouse/procurement is expected
    assert not bg_tasks.add_task.called
