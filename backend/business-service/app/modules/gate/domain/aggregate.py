"""
GateEntry Aggregate Root.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid

from app.modules.gate.domain.enums import GateEntryStatus, MismatchField
from app.modules.gate.domain.events import (
    DomainEvent,
    GateEntryApprovedEvent,
    GateEntryCreatedEvent,
    GateEntryManualVerificationRequiredEvent,
    GateEntryRejectedEvent,
    GateEntryVerifiedEvent,
)
from app.modules.gate.domain.value_objects import AnprResult, DriverInfo, GateEntryId, OcrResult, VehicleNumber, VerificationResult


@dataclass
class AuditLogEntry:
    id: uuid.UUID
    action: str
    performed_by: str
    timestamp: datetime
    details: dict


class GateEntry:
    def __init__(
        self,
        id: GateEntryId,
        po_number: str,
        vehicle_number: VehicleNumber,
        driver_info: DriverInfo,
        security_officer_id: str,
        po_document_path: str,
        driver_photo_path: str | None = None,
        vehicle_photo_path: str | None = None,
        po_id: str | None = None,
        status: GateEntryStatus = GateEntryStatus.PENDING_VERIFICATION,
        anpr_result: AnprResult | None = None,
        ocr_result: OcrResult | None = None,
        verification_result: VerificationResult | None = None,
        mismatched_fields: list[MismatchField] | None = None,
        verified_by_user_id: str | None = None,
        manual_verification_notes: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id
        self.po_number = po_number
        self.vehicle_number = vehicle_number
        self.driver_info = driver_info
        self.security_officer_id = security_officer_id
        self.driver_photo_path = driver_photo_path
        self.po_document_path = po_document_path
        self.vehicle_photo_path = vehicle_photo_path
        self.po_id = po_id
        self.status = status
        self.anpr_result = anpr_result
        self.ocr_result = ocr_result
        self.verification_result = verification_result
        self.mismatched_fields = mismatched_fields or []
        self.verified_by_user_id = verified_by_user_id
        self.manual_verification_notes = manual_verification_notes
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)
        self.audit_logs: list[AuditLogEntry] = []
        self._domain_events: list[DomainEvent] = []

    @property
    def domain_events(self) -> list[DomainEvent]:
        return list(self._domain_events)

    def clear_domain_events(self) -> None:
        self._domain_events.clear()

    @classmethod
    def create(
        self,
        po_number: str,
        vehicle_number: str,
        driver_name: str,
        security_officer_id: str,
        po_document_path: str,
        driver_photo_path: str | None = None,
        vehicle_photo_path: str | None = None,
        driver_license_number: str | None = None,
        driver_phone: str | None = None,
    ) -> GateEntry:
        gate_entry_id = GateEntryId.generate()
        vehicle = VehicleNumber(vehicle_number)
        driver = DriverInfo(
            driver_name=driver_name,
            driver_license_number=driver_license_number,
            driver_phone=driver_phone,
        )

        entry = GateEntry(
            id=gate_entry_id,
            po_number=po_number,
            vehicle_number=vehicle,
            driver_info=driver,
            security_officer_id=security_officer_id,
            driver_photo_path=driver_photo_path,
            po_document_path=po_document_path,
            vehicle_photo_path=vehicle_photo_path,
            status=GateEntryStatus.PENDING_VERIFICATION,
        )

        entry.record_audit("CREATE_GATE_ENTRY", security_officer_id, {"po_number": po_number, "vehicle_number": vehicle_number})
        entry._domain_events.append(
            GateEntryCreatedEvent(
                gate_entry_id=str(gate_entry_id),
                po_number=po_number,
                vehicle_number=vehicle_number,
                driver_name=driver_name,
                status=GateEntryStatus.PENDING_VERIFICATION.value,
                security_officer_id=security_officer_id,
            )
        )
        return entry

    def apply_verification(
        self,
        po_id: str | None,
        anpr_result: AnprResult | None,
        ocr_result: OcrResult | None,
        verification_result: VerificationResult,
    ) -> None:
        self.po_id = po_id
        self.anpr_result = anpr_result
        self.ocr_result = ocr_result
        self.verification_result = verification_result
        self.status = verification_result.status
        self.mismatched_fields = verification_result.mismatched_fields
        self.updated_at = datetime.now(timezone.utc)

        mismatches_str = [m.value for m in verification_result.mismatched_fields]
        details = {
            "status": self.status.value,
            "verification_type": verification_result.verification_type.value,
            "mismatched_fields": mismatches_str,
            "reasons": verification_result.reasons,
        }
        self.record_audit("VERIFY_GATE_ENTRY", self.security_officer_id, details)

        if self.status in (GateEntryStatus.PO_VERIFIED, GateEntryStatus.APPROVED):
            self._domain_events.append(
                GateEntryVerifiedEvent(
                    gate_entry_id=str(self.id),
                    po_number=self.po_number,
                    vehicle_number=self.vehicle_number.value,
                    status=self.status.value,
                    mismatched_fields=mismatches_str,
                )
            )
        elif self.status in (GateEntryStatus.MANUAL_VERIFICATION_REQUIRED, GateEntryStatus.UNSCHEDULED_ARRIVAL):
            self._domain_events.append(
                GateEntryManualVerificationRequiredEvent(
                    gate_entry_id=str(self.id),
                    po_number=self.po_number,
                    vehicle_number=self.vehicle_number.value,
                    mismatched_fields=mismatches_str,
                    reasons=verification_result.reasons,
                )
            )

    def manual_verify(
        self,
        approved: bool,
        verified_by_user_id: str,
        notes: str | None = None,
    ) -> None:
        if self.status not in (
            GateEntryStatus.MANUAL_VERIFICATION_REQUIRED,
            GateEntryStatus.UNSCHEDULED_ARRIVAL,
            GateEntryStatus.PENDING_VERIFICATION,
        ):
            raise ValueError(f"Cannot perform manual verification on entry in status {self.status.value}")

        self.verified_by_user_id = verified_by_user_id
        self.manual_verification_notes = notes
        self.updated_at = datetime.now(timezone.utc)

        if approved:
            self.status = GateEntryStatus.APPROVED
            self.record_audit("MANUAL_APPROVE", verified_by_user_id, {"notes": notes})
            self._domain_events.append(
                GateEntryApprovedEvent(
                    gate_entry_id=str(self.id),
                    po_number=self.po_number,
                    vehicle_number=self.vehicle_number.value,
                    approved_by=verified_by_user_id,
                    notes=notes,
                )
            )
        else:
            self.status = GateEntryStatus.REJECTED
            self.record_audit("MANUAL_REJECT", verified_by_user_id, {"notes": notes})
            self._domain_events.append(
                GateEntryRejectedEvent(
                    gate_entry_id=str(self.id),
                    po_number=self.po_number,
                    vehicle_number=self.vehicle_number.value,
                    rejected_by=verified_by_user_id,
                    reason=notes or "Manual rejection by supervisor",
                )
            )

    def record_audit(self, action: str, performed_by: str, details: dict) -> None:
        log = AuditLogEntry(
            id=uuid.uuid4(),
            action=action,
            performed_by=performed_by,
            timestamp=datetime.now(timezone.utc),
            details=details,
        )
        self.audit_logs.append(log)
