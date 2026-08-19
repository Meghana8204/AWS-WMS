"""
Value objects and enumerations for the Gate Entry module.
Refactored for PO Document OCR Scanning & Manual Vehicle Plate Entry.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional


class GateEntryStatus(str, Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    PO_VERIFIED = "PO_VERIFIED"
    FIELD_MISMATCH_DETECTED = "FIELD_MISMATCH_DETECTED"
    MANUAL_VERIFICATION_REQUIRED = "MANUAL_VERIFICATION_REQUIRED"
    UNSCHEDULED_ARRIVAL = "UNSCHEDULED_ARRIVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


@dataclass(frozen=True)
class OcrResult:
    po_number: Optional[str]
    supplier_name: Optional[str]
    material_description: Optional[str]
    total_quantity: Optional[float]
    po_date: Optional[str]
    delivery_date: Optional[str]
    confidence: float
    line_items: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class AnprResult:
    detected_vehicle_number: str
    confidence: float
    raw_metadata: dict[str, Any]


@dataclass(frozen=True)
class FieldMismatch:
    field_name: str
    extracted_value: Any
    canonical_value: Any


@dataclass(frozen=True)
class PurchaseOrderRecord:
    po_number: str
    supplier_name: str
    material_description: str
    total_quantity: float
    po_date: str
    delivery_date: str
    status: str = "OPEN"
