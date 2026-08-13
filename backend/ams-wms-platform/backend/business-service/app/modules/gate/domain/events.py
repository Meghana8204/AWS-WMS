"""
Gate Entry Domain Events.
"""
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class GateEntryCreatedEvent:
    gate_entry_id: str
    gate_entry_number: str
    vehicle_number: str
    warehouse_id: str
    asn_id: str | None
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class GateDockAssignedEvent:
    gate_entry_id: str
    vehicle_number: str
    dock_id: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class GateCheckedOutEvent:
    gate_entry_id: str
    vehicle_number: str
    exit_time: datetime = datetime.now(timezone.utc)
    occurred_at: datetime = datetime.now(timezone.utc)
