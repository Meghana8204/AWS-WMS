"""
GateEntry Aggregate Root and Gate Entry Number generator.
Refactored to remove ANPR and treat vehicle_plate as a mandatory manual input string.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.common.domain.aggregate_root import AggregateRoot
from app.common.domain.events import DomainEvent
from app.common.domain.exceptions import DomainRuleViolationException
from app.modules.gate.domain.events import GateEntryReadyForReceivingEvent
from app.modules.gate.domain.value_objects import (
    FieldMismatch,
    GateEntryStatus,
    OcrResult,
)


def generate_gate_entry_number(created_at: Optional[datetime] = None) -> str:
    """
    Generates a unique gate entry number with format GE-YYYYMMDD-<6-HEX-SUFFIX>.
    Example: GE-20260813-A8F32B
    """
    dt = created_at or datetime.now(timezone.utc)
    date_str = dt.strftime("%Y%m%d")
    hex_suffix = uuid.uuid4().hex[:6].upper()
    return f"GE-{date_str}-{hex_suffix}"


class GateEntry(AggregateRoot):
    def __init__(
        self,
        id: str,
        vehicle_plate: str,
        status: GateEntryStatus,
        created_by: str,
        driver_name: Optional[str] = "Driver",
        gate_entry_number: Optional[str] = None,
        po_id: Optional[str] = None,
        po_number: Optional[str] = None,
        truck_photo_base64: Optional[str] = None,
        ocr_result: Optional[OcrResult] = None,
        mismatched_fields: Optional[List[FieldMismatch]] = None,
        verified_by: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        super().__init__()
        self.id = id
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or self.created_at
        self.gate_entry_number = gate_entry_number or generate_gate_entry_number(self.created_at)
        self.vehicle_plate = vehicle_plate
        self.driver_name = driver_name
        self.po_id = po_id
        self.po_number = po_number
        self.truck_photo_base64 = truck_photo_base64
        self.status = status
        self.ocr_result = ocr_result
        self.mismatched_fields = mismatched_fields or []
        self.created_by = created_by
        self.verified_by = verified_by

    @classmethod
    def create(
        cls,
        vehicle_plate: str,
        created_by: str,
        driver_name: Optional[str] = "Driver",
        po_number: Optional[str] = None,
        po_id: Optional[str] = None,
        truck_photo_base64: Optional[str] = None,
        ocr_result: Optional[OcrResult] = None,
        status: GateEntryStatus = GateEntryStatus.UNSCHEDULED_ARRIVAL,
        mismatched_fields: Optional[List[FieldMismatch]] = None,

    ) -> GateEntry:
        """Create a new Gate Entry aggregate root."""
        if not vehicle_plate or not vehicle_plate.strip():
            raise DomainRuleViolationException("Vehicle plate number is required for gate entry")

        entry = cls(
            id=str(uuid.uuid4()),
            vehicle_plate=vehicle_plate.strip().upper(),
            driver_name=driver_name,
            status=status,
            created_by=created_by,
            po_id=po_id,
            po_number=po_number,
            truck_photo_base64=truck_photo_base64,
            ocr_result=ocr_result,
            mismatched_fields=mismatched_fields or [],
        )

        if status in (GateEntryStatus.PO_VERIFIED, GateEntryStatus.APPROVED):
            entry._emit_ready_event()

        return entry

    def update_verification_results(
        self,
        status: GateEntryStatus,
        po_id: Optional[str] = None,
        po_number: Optional[str] = None,
        mismatched_fields: Optional[List[FieldMismatch]] = None,
    ) -> None:
        """Update automated verification status and field mismatches."""
        self.status = status
        if po_id:
            self.po_id = po_id
        if po_number:
            self.po_number = po_number
        if mismatched_fields is not None:
            self.mismatched_fields = mismatched_fields
        self.updated_at = datetime.now(timezone.utc)

        if self.status in (GateEntryStatus.PO_VERIFIED, GateEntryStatus.APPROVED):
            self._emit_ready_event()

    def approve(self, supervisor_id: str, remarks: Optional[str] = None) -> None:
        """Manual supervisor approval for manual verification / field mismatches / unscheduled arrivals."""
        if self.status in (GateEntryStatus.APPROVED, GateEntryStatus.REJECTED):
            raise DomainRuleViolationException(f"Gate entry is already in terminal status: {self.status}")

        self.status = GateEntryStatus.APPROVED
        self.verified_by = supervisor_id
        self.updated_at = datetime.now(timezone.utc)
        self._emit_ready_event()

    def reject(self, supervisor_id: str, reason: str) -> None:
        """Reject gate entry attempt."""
        if not reason or not reason.strip():
            raise DomainRuleViolationException("Rejection reason must be provided")

        if self.status in (GateEntryStatus.APPROVED, GateEntryStatus.REJECTED):
            raise DomainRuleViolationException(f"Gate entry is already in terminal status: {self.status}")

        self.status = GateEntryStatus.REJECTED
        self.verified_by = supervisor_id
        self.updated_at = datetime.now(timezone.utc)

    def mark_unscheduled(self, supervisor_id: str, remarks: Optional[str] = None) -> None:
        """Transition gate entry status to UNSCHEDULED_ARRIVAL after supervisor review."""
        if self.status in (GateEntryStatus.APPROVED, GateEntryStatus.REJECTED):
            raise DomainRuleViolationException(f"Gate entry is already in terminal status: {self.status}")

        self.status = GateEntryStatus.UNSCHEDULED_ARRIVAL
        self.verified_by = supervisor_id
        self.updated_at = datetime.now(timezone.utc)


    def _emit_ready_event(self) -> None:
        event = GateEntryReadyForReceivingEvent(
            gate_entry_id=self.id,
            gate_entry_number=self.gate_entry_number,
            po_number=self.po_number,
            vehicle_plate=self.vehicle_plate,
            status=self.status.value if isinstance(self.status, GateEntryStatus) else str(self.status),
            occurred_at=DomainEvent.now(),
        )
        self._register_event(event)

    @classmethod
    def rehydrate(
        cls,
        id: str,
        gate_entry_number: str,
        vehicle_plate: str,
        status: GateEntryStatus,
        created_by: str,
        driver_name: Optional[str] = "Driver",
        po_id: Optional[str] = None,
        po_number: Optional[str] = None,
        truck_photo_base64: Optional[str] = None,
        ocr_result: Optional[OcrResult] = None,
        mismatched_fields: Optional[List[FieldMismatch]] = None,
        verified_by: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> GateEntry:
        """Reconstruct GateEntry from persistence without raising events."""
        return cls(
            id=id,
            gate_entry_number=gate_entry_number,
            vehicle_plate=vehicle_plate,
            status=status,
            created_by=created_by,
            driver_name=driver_name,
            po_id=po_id,
            po_number=po_number,
            truck_photo_base64=truck_photo_base64,
            ocr_result=ocr_result,
            mismatched_fields=mismatched_fields,
            verified_by=verified_by,
            created_at=created_at,
            updated_at=updated_at,
        )
