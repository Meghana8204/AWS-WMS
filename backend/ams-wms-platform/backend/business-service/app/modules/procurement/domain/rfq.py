"""
Request For Quotation (RFQ) Aggregate.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
import random
import string
import uuid


class RFQStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    QUOTATIONS_RECEIVED = "QUOTATIONS_RECEIVED"
    EVALUATED = "EVALUATED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


def generate_rfq_number() -> str:
    year_str = date.today().strftime("%Y")
    suffix = "".join(random.choices(string.digits, k=4))
    return f"RFQ-{year_str}-{suffix}"


@dataclass
class RFQItem:
    id: str
    material_code: str
    material_name: str
    quantity: Decimal
    unit_of_measure: str = "PCS"

    @classmethod
    def create(
        cls,
        material_code: str,
        material_name: str,
        quantity: Decimal | float | int,
        unit_of_measure: str = "PCS",
        item_id: str | None = None,
    ) -> "RFQItem":
        qty = Decimal(str(quantity))
        if qty <= Decimal("0"):
            raise ValueError("RFQ item quantity must be greater than zero")
        return cls(
            id=item_id or str(uuid.uuid4()),
            material_code=material_code,
            material_name=material_name,
            quantity=qty,
            unit_of_measure=unit_of_measure,
        )


@dataclass
class RFQSupplier:
    supplier_id: str
    supplier_code: str
    supplier_name: str
    email: str | None = None
    status: str = "INVITED"  # INVITED, RESPONDED, DECLINED


@dataclass
class RequestForQuotation:
    id: str
    rfq_number: str
    title: str
    warehouse_id: str
    issue_date: date
    due_date: date
    status: RFQStatus = RFQStatus.DRAFT
    material_request_ids: list[str] = field(default_factory=list)
    terms_and_conditions: str | None = None
    selected_supplier_id: str | None = None
    selected_supplier_name: str | None = None
    selection_date: datetime | None = None
    selected_by: str | None = None
    selection_reason: str | None = None
    procurement_comments: str | None = None
    items: list[RFQItem] = field(default_factory=list)
    invited_suppliers: list[RFQSupplier] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    recorded_events: list[object] = field(default_factory=list, repr=False)

    @classmethod
    def create(
        cls,
        title: str,
        warehouse_id: str,
        due_date: date,
        items: list[RFQItem],
        invited_suppliers: list[RFQSupplier] | None = None,
        material_request_ids: list[str] | None = None,
        terms_and_conditions: str | None = None,
        rfq_number: str | None = None,
        rfq_id: str | None = None,
    ) -> "RequestForQuotation":
        if not title or not title.strip():
            raise ValueError("RFQ Title is required")
        if not items:
            raise ValueError("At least one RFQ line item is required")

        return cls(
            id=rfq_id or f"RFQ-{uuid.uuid4().hex[:8].upper()}",
            rfq_number=rfq_number or generate_rfq_number(),
            title=title,
            warehouse_id=warehouse_id,
            issue_date=date.today(),
            due_date=due_date,
            status=RFQStatus.DRAFT,
            items=items,
            invited_suppliers=invited_suppliers or [],
            material_request_ids=material_request_ids or [],
            terms_and_conditions=terms_and_conditions,
        )

    def publish(self) -> None:
        if not self.invited_suppliers:
            raise ValueError("Cannot publish RFQ without invited suppliers")
        self.status = RFQStatus.PUBLISHED
        self.updated_at = datetime.now(timezone.utc)

    def mark_quotations_received(self) -> None:
        self.status = RFQStatus.QUOTATIONS_RECEIVED
        self.updated_at = datetime.now(timezone.utc)

    def select_supplier(
        self,
        supplier_id: str,
        supplier_name: str,
        selected_by: str = "John Buyer",
        selection_reason: str = "Lowest commercial bid with fast lead time",
        procurement_comments: str | None = None,
    ) -> None:
        self.selected_supplier_id = supplier_id
        self.selected_supplier_name = supplier_name
        self.selection_date = datetime.now(timezone.utc)
        self.selected_by = selected_by
        self.selection_reason = selection_reason
        self.procurement_comments = procurement_comments or selection_reason
        self.status = RFQStatus.EVALUATED
        self.updated_at = datetime.now(timezone.utc)

    def close(self) -> None:
        self.status = RFQStatus.CLOSED
        self.updated_at = datetime.now(timezone.utc)
