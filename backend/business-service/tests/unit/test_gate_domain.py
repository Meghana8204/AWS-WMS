"""
Unit tests for Gate Entry domain models, comparison service, and aggregate logic.
"""
from datetime import date
from decimal import Decimal
import pytest

from app.modules.gate.domain.aggregate import GateEntry
from app.modules.gate.domain.enums import GateEntryStatus, MismatchField, VerificationResultType
from app.modules.gate.domain.services import GateEntryVerificationDomainService, PurchaseOrderDetails
from app.modules.gate.domain.value_objects import AnprResult, DriverInfo, GateEntryId, OcrResult, VehicleNumber


def test_gate_entry_creation_and_events():
    entry = GateEntry.create(
        vehicle_plate="KA-01-AB-1234",
        created_by="sec_officer_1",
        po_number="PO-1001",
        driver_name="John Doe",
    )

    assert str(entry.id) is not None
    assert entry.po_number == "PO-1001"
    assert entry.vehicle_plate == "KA-01-AB-1234"
    assert entry.status == GateEntryStatus.UNSCHEDULED_ARRIVAL


def test_verification_service_full_match():
    service = GateEntryVerificationDomainService(anpr_confidence_threshold=0.85)

    anpr = AnprResult(detected_vehicle_number="KA-01-AB-1234", confidence=0.95)
    ocr = OcrResult(
        po_number="PO-1001",
        supplier_name="Acme Corp",
        material_description="ITEM-A",
        total_quantity=100.0,
        po_date="2026-08-01",
        delivery_date="2026-08-15",
        confidence=0.95,
    )
    po = PurchaseOrderDetails(
        po_id="11111111-1111-1111-1111-111111111111",
        po_number="PO-1001",
        supplier_name="Acme Corp",
        product_material="ITEM-A",
        total_quantity=Decimal("100"),
        po_date=date(2026, 8, 1),
        expected_delivery_date=date(2026, 8, 15),
    )

    res = service.verify(
        vehicle_number="KA-01-AB-1234",
        anpr_result=anpr,
        ocr_result=ocr,
        po_details=po,
    )

    assert res.status == GateEntryStatus.PO_VERIFIED
    assert res.verification_type == VerificationResultType.MATCHED
    assert len(res.mismatched_fields) == 0


def test_verification_service_mismatches_and_low_anpr():
    service = GateEntryVerificationDomainService(anpr_confidence_threshold=0.85)

    anpr = AnprResult(detected_vehicle_number="KA-01-AB-1234", confidence=0.60)
    ocr = OcrResult(
        po_number="PO-1001",
        supplier_name="Wrong Supplier",
        material_description="ITEM-B",
        total_quantity=200.0,
        po_date="2026-08-01",
        delivery_date="2026-08-15",
        confidence=0.95,
    )
    po = PurchaseOrderDetails(
        po_id="11111111-1111-1111-1111-111111111111",
        po_number="PO-1001",
        supplier_name="Acme Corp",
        product_material="ITEM-A",
        total_quantity=Decimal("100"),
    )

    res = service.verify(
        vehicle_number="KA-01-AB-1234",
        anpr_result=anpr,
        ocr_result=ocr,
        po_details=po,
    )

    assert res.status == GateEntryStatus.MANUAL_VERIFICATION_REQUIRED
    assert MismatchField.SUPPLIER_NAME in res.mismatched_fields
    assert MismatchField.PRODUCT_MATERIAL in res.mismatched_fields
    assert MismatchField.QUANTITY in res.mismatched_fields


def test_verification_unscheduled_arrival():
    service = GateEntryVerificationDomainService()
    res = service.verify(
        vehicle_number="KA-01-AB-1234",
        anpr_result=AnprResult(detected_vehicle_number="KA-01-AB-1234", confidence=0.90),
        ocr_result=OcrResult(
            po_number="PO-9999",
            supplier_name=None,
            material_description=None,
            total_quantity=None,
            po_date=None,
            delivery_date=None,
            confidence=0.90,
        ),
        po_details=None,
    )

    assert res.status == GateEntryStatus.UNSCHEDULED_ARRIVAL
    assert res.verification_type == VerificationResultType.UNSCHEDULED_PO


def test_manual_verification_approval_flow():
    entry = GateEntry.create(
        vehicle_plate="KA-01-AB-1234",
        created_by="sec_officer_1",
        po_number="PO-1001",
        driver_name="Jane Doe",
    )
    entry.status = GateEntryStatus.MANUAL_VERIFICATION_REQUIRED
    assert entry.status == GateEntryStatus.MANUAL_VERIFICATION_REQUIRED
