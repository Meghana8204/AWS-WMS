"""
Material Request Aggregate (Raw Material Requisition).
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
import random
import string
import uuid


class MaterialRequestStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_RFQ = "IN_RFQ"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class PriorityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


def generate_request_number() -> str:
    today_str = date.today().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.digits, k=4))
    return f"REQ-{today_str}-{suffix}"


@dataclass
class MaterialRequestItem:
    id: str
    material_code: str
    material_name: str
    category: str
    unit_of_measure: str
    requested_qty: Decimal
    estimated_unit_cost: Decimal = Decimal("0.00")
    notes: str | None = None

    @classmethod
    def create(
        cls,
        material_code: str,
        material_name: str,
        requested_qty: Decimal | float | int,
        category: str = "Raw Material",
        unit_of_measure: str = "PCS",
        estimated_unit_cost: Decimal | float | int = 0.0,
        notes: str | None = None,
        item_id: str | None = None,
    ) -> "MaterialRequestItem":
        qty = Decimal(str(requested_qty))
        cost = Decimal(str(estimated_unit_cost))
        if qty <= Decimal("0"):
            raise ValueError(f"Quantity for '{material_code}' must be greater than zero")
        return cls(
            id=item_id or str(uuid.uuid4()),
            material_code=material_code.strip(),
            material_name=material_name.strip(),
            category=category,
            unit_of_measure=unit_of_measure,
            requested_qty=qty,
            estimated_unit_cost=cost,
            notes=notes,
        )

    @property
    def estimated_total_cost(self) -> Decimal:
        return self.requested_qty * self.estimated_unit_cost


@dataclass
class MaterialRequest:
    id: str
    request_number: str
    warehouse_id: str
    department: str
    requested_by: str
    target_delivery_date: date
    priority: PriorityLevel = PriorityLevel.MEDIUM
    status: MaterialRequestStatus = MaterialRequestStatus.DRAFT
    rejection_reason: str | None = None
    items: list[MaterialRequestItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    recorded_events: list[object] = field(default_factory=list, repr=False)

    @classmethod
    def create(
        cls,
        warehouse_id: str,
        department: str,
        requested_by: str,
        target_delivery_date: date,
        items: list[MaterialRequestItem],
        priority: PriorityLevel = PriorityLevel.MEDIUM,
        request_number: str | None = None,
        request_id: str | None = None,
    ) -> "MaterialRequest":
        if not warehouse_id or not warehouse_id.strip():
            raise ValueError("Warehouse ID is required")
        if not items:
            raise ValueError("At least one request item is required")

        req = cls(
            id=request_id or f"MR-{uuid.uuid4().hex[:8].upper()}",
            request_number=request_number or generate_request_number(),
            warehouse_id=warehouse_id,
            department=department,
            requested_by=requested_by,
            target_delivery_date=target_delivery_date,
            priority=priority,
            status=MaterialRequestStatus.DRAFT,
            items=items,
        )
        return req

    def submit(self) -> None:
        if self.status != MaterialRequestStatus.DRAFT:
            raise ValueError(f"Cannot submit request in status {self.status.value}")
        self.status = MaterialRequestStatus.SUBMITTED
        self.updated_at = datetime.now(timezone.utc)

    def approve(self) -> None:
        if self.status != MaterialRequestStatus.SUBMITTED:
            raise ValueError(f"Cannot approve request in status {self.status.value}")
        self.status = MaterialRequestStatus.APPROVED
        self.updated_at = datetime.now(timezone.utc)

    def reject(self, reason: str) -> None:
        if self.status != MaterialRequestStatus.SUBMITTED:
            raise ValueError(f"Cannot reject request in status {self.status.value}")
        self.status = MaterialRequestStatus.REJECTED
        self.rejection_reason = reason
        self.updated_at = datetime.now(timezone.utc)

    def mark_in_rfq(self) -> None:
        self.status = MaterialRequestStatus.IN_RFQ
        self.updated_at = datetime.now(timezone.utc)

    @property
    def total_estimated_cost(self) -> Decimal:
        return sum((item.estimated_total_cost for item in self.items), Decimal("0.00"))
