"""
Pydantic Data Transfer Objects (DTOs) for Gate Entry REST API.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.gate.domain.enums import GateEntryStatus, MismatchField, VerificationResultType

if TYPE_CHECKING:
    from app.modules.gate.domain.aggregate import GateEntry


class AuditLogResponse(BaseModel):
    id: str
    action: str
    performed_by: str
    timestamp: datetime
    details: dict[str, Any] = Field(default_factory=dict)


class AnprResultResponse(BaseModel):
    detected_vehicle_number: str
    confidence: float
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


class OcrResultResponse(BaseModel):
    po_number: str | None = None
    supplier_name: str | None = None
    product_material: str | None = None
    quantity: Decimal | None = None
    po_date: date | None = None
    expected_delivery_date: date | None = None
    confidence: float = 1.0
    raw_text: str = ""


class VerificationResultResponse(BaseModel):
    status: GateEntryStatus
    verification_type: VerificationResultType
    mismatched_fields: list[MismatchField] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class GateEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    po_id: str | None = None
    po_number: str
    vehicle_number: str
    driver_name: str
    driver_license_number: str | None = None
    driver_phone: str | None = None
    driver_photo_path: str | None = None
    po_document_path: str
    vehicle_photo_path: str | None = None
    status: GateEntryStatus
    security_officer_id: str
    verified_by_user_id: str | None = None
    manual_verification_notes: str | None = None
    mismatched_fields: list[MismatchField] = Field(default_factory=list)
    anpr_result: AnprResultResponse | None = None
    ocr_result: OcrResultResponse | None = None
    verification_result: VerificationResultResponse | None = None
    created_at: datetime
    updated_at: datetime
    audit_logs: list[AuditLogResponse] = Field(default_factory=list)


class ManualVerifyRequest(BaseModel):
    approved: bool = Field(..., description="True to approve, False to reject")
    notes: str | None = Field(None, description="Optional supervisor notes or rejection reason")


def gate_entry_to_response(entry: GateEntry) -> GateEntryResponse:
    anpr_resp = None
    if entry.anpr_result:
        anpr_resp = AnprResultResponse(
            detected_vehicle_number=entry.anpr_result.detected_vehicle_number,
            confidence=entry.anpr_result.confidence,
            raw_metadata=entry.anpr_result.raw_metadata or {},
        )

    ocr_resp = None
    if entry.ocr_result:
        ocr_resp = OcrResultResponse(
            po_number=entry.ocr_result.po_number,
            supplier_name=entry.ocr_result.supplier_name,
            product_material=entry.ocr_result.product_material,
            quantity=entry.ocr_result.quantity,
            po_date=entry.ocr_result.po_date,
            expected_delivery_date=entry.ocr_result.expected_delivery_date,
            confidence=entry.ocr_result.confidence,
            raw_text=entry.ocr_result.raw_text,
        )

    verif_resp = None
    if entry.verification_result:
        verif_resp = VerificationResultResponse(
            status=entry.verification_result.status,
            verification_type=entry.verification_result.verification_type,
            mismatched_fields=entry.verification_result.mismatched_fields,
            reasons=entry.verification_result.reasons,
        )

    audit_resps = [
        AuditLogResponse(
            id=str(log.id),
            action=log.action,
            performed_by=log.performed_by,
            timestamp=log.timestamp,
            details=log.details or {},
        )
        for log in entry.audit_logs
    ]

    return GateEntryResponse(
        id=str(entry.id),
        po_id=entry.po_id,
        po_number=entry.po_number,
        vehicle_number=entry.vehicle_number.value,
        driver_name=entry.driver_info.driver_name,
        driver_license_number=entry.driver_info.driver_license_number,
        driver_phone=entry.driver_info.driver_phone,
        driver_photo_path=entry.driver_photo_path,
        po_document_path=entry.po_document_path,
        vehicle_photo_path=entry.vehicle_photo_path,
        status=entry.status,
        security_officer_id=entry.security_officer_id,
        verified_by_user_id=entry.verified_by_user_id,
        manual_verification_notes=entry.manual_verification_notes,
        mismatched_fields=entry.mismatched_fields,
        anpr_result=anpr_resp,
        ocr_result=ocr_resp,
        verification_result=verif_resp,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        audit_logs=audit_resps,
    )
