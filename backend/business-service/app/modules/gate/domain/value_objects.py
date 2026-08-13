"""
Value Objects for Gate Entry domain.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
import uuid
from typing import Any

from app.modules.gate.domain.enums import GateEntryStatus, MismatchField, VerificationResultType


@dataclass(frozen=True)
class GateEntryId:
    value: uuid.UUID

    @staticmethod
    def generate() -> GateEntryId:
        return GateEntryId(uuid.uuid4())

    @staticmethod
    def of(val: str | uuid.UUID) -> GateEntryId:
        if isinstance(val, uuid.UUID):
            return GateEntryId(val)
        return GateEntryId(uuid.UUID(val))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class VehicleNumber:
    value: str

    def __post_init__(self) -> None:
        if not self.value or not self.value.strip():
            raise ValueError("Vehicle number cannot be empty")

    @property
    def normalized(self) -> str:
        return "".join(c.upper() for c in self.value if c.isalnum())


@dataclass(frozen=True)
class DriverInfo:
    driver_name: str
    driver_license_number: str | None = None
    driver_phone: str | None = None

    def __post_init__(self) -> None:
        if not self.driver_name or not self.driver_name.strip():
            raise ValueError("Driver name cannot be empty")


@dataclass(frozen=True)
class AnprResult:
    detected_vehicle_number: str
    confidence: float
    raw_metadata: dict[str, Any] = field(default_factory=dict)

    def is_high_confidence(self, threshold: float = 0.85) -> bool:
        return self.confidence >= threshold


@dataclass(frozen=True)
class OcrResult:
    po_number: str | None
    supplier_name: str | None = None
    product_material: str | None = None
    quantity: Decimal | None = None
    po_date: date | None = None
    expected_delivery_date: date | None = None
    confidence: float = 1.0
    raw_text: str = ""


@dataclass(frozen=True)
class VerificationResult:
    status: GateEntryStatus
    verification_type: VerificationResultType
    mismatched_fields: list[MismatchField] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)

    @property
    def requires_manual_verification(self) -> bool:
        return self.status in (
            GateEntryStatus.MANUAL_VERIFICATION_REQUIRED,
            GateEntryStatus.UNSCHEDULED_ARRIVAL,
            GateEntryStatus.PENDING_VERIFICATION,
        )
