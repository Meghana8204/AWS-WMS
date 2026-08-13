"""
Domain events for Gate Entry module.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(kw_only=True)
class DomainEvent:
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(kw_only=True)
class GateEntryCreatedEvent(DomainEvent):
    gate_entry_id: str = ""
    po_number: str = ""
    vehicle_number: str = ""
    driver_name: str = ""
    status: str = ""
    security_officer_id: str = ""


@dataclass(kw_only=True)
class GateEntryVerifiedEvent(DomainEvent):
    gate_entry_id: str = ""
    po_number: str = ""
    vehicle_number: str = ""
    status: str = ""
    mismatched_fields: list[str] = field(default_factory=list)


@dataclass(kw_only=True)
class GateEntryManualVerificationRequiredEvent(DomainEvent):
    gate_entry_id: str = ""
    po_number: str = ""
    vehicle_number: str = ""
    mismatched_fields: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


@dataclass(kw_only=True)
class GateEntryApprovedEvent(DomainEvent):
    gate_entry_id: str = ""
    po_number: str = ""
    vehicle_number: str = ""
    approved_by: str = ""
    notes: str | None = None


@dataclass(kw_only=True)
class GateEntryRejectedEvent(DomainEvent):
    gate_entry_id: str = ""
    po_number: str = ""
    vehicle_number: str = ""
    rejected_by: str = ""
    reason: str = ""
