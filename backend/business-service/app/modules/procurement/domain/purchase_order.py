from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import List

from app.common.domain.aggregate_root import AggregateRoot
from app.common.domain.events import DomainEvent
from app.modules.procurement.domain.events import PurchaseOrderPlacedEvent
from app.modules.procurement.domain.value_objects import PurchaseOrderId, QuotationId, SupplierId


@dataclass
class PurchaseOrderLine:
    item_code: str
    ordered_quantity: Decimal
    unit_price: Decimal
    material_name: str | None = None
    category: str | None = None
    uom: str | None = "PCS"
    discount: Decimal = Decimal("0.0")
    tax: Decimal = Decimal("0.0")

    @property
    def gross_amount(self) -> Decimal:
        return self.ordered_quantity * self.unit_price

    @property
    def line_subtotal(self) -> Decimal:
        return self.gross_amount - self.discount

    @property
    def line_total(self) -> Decimal:
        return self.line_subtotal + self.tax


@dataclass
class PurchaseOrderApprovalLog:
    id: str
    status: str
    actor: str
    action_date: datetime
    reason: str | None = None
    comments: str | None = None


class PurchaseOrder(AggregateRoot):
    def __init__(
        self,
        id: PurchaseOrderId,
        po_number: str,
        quotation_id: QuotationId | None,
        supplier_id: SupplierId,
        status: str,
        lines: List[PurchaseOrderLine],
        po_date: date,
        expected_delivery_date: date | None = None,
        created_at: datetime | None = None,
        rejection_reason: str | None = None,
        finance_comments: str | None = None,
        logs: List[PurchaseOrderApprovalLog] = None,
        additional_charges: Decimal = Decimal("0.0"),
    ) -> None:
        super().__init__()
        self.id = id
        self.po_number = po_number
        self.quotation_id = quotation_id
        self.supplier_id = supplier_id
        self.status = status
        self.lines = lines
        self.po_date = po_date
        self.expected_delivery_date = expected_delivery_date
        self.created_at = created_at or datetime.now()
        self.rejection_reason = rejection_reason
        self.finance_comments = finance_comments
        self.logs = logs or []
        self.additional_charges = additional_charges

    @property
    def subtotal(self) -> Decimal:
        return sum((line.gross_amount for line in self.lines), Decimal("0.0"))

    @property
    def total_discount(self) -> Decimal:
        return sum((line.discount for line in self.lines), Decimal("0.0"))

    @property
    def tax_amount(self) -> Decimal:
        return sum((line.tax for line in self.lines), Decimal("0.0"))

    @property
    def grand_total(self) -> Decimal:
        return self.subtotal - self.total_discount + self.tax_amount + self.additional_charges

    @staticmethod
    def create(
        po_number: str,
        supplier_id: SupplierId,
        lines: List[PurchaseOrderLine],
        quotation_id: QuotationId | None = None,
        po_date: date | None = None,
    ) -> PurchaseOrder:
        po = PurchaseOrder(
            id=PurchaseOrderId.new_id(),
            po_number=po_number,
            quotation_id=quotation_id,
            supplier_id=supplier_id,
            status="PROPOSED",
            lines=lines,
            po_date=po_date or date.today(),
        )
        return po

    def approve(self, actor: str, comments: str | None = None) -> None:
        self.status = "PLACED"
        self.rejection_reason = None
        self.finance_comments = comments
        # Add log
        import uuid
        self.logs.append(
            PurchaseOrderApprovalLog(
                id=str(uuid.uuid4()),
                status="APPROVED",
                actor=actor,
                action_date=datetime.now(),
                reason=None,
                comments=comments,
            )
        )
        self._register_event(
            PurchaseOrderPlacedEvent(
                po_id=str(self.id),
                po_number=self.po_number,
                supplier_id=str(self.supplier_id),
                occurred_at=DomainEvent.now(),
            )
        )

    def reject(self, actor: str, reason: str, comments: str | None = None) -> None:
        if not reason:
            raise ValueError("Rejection reason is mandatory")
        self.status = "REJECTED"
        self.rejection_reason = reason
        self.finance_comments = comments
        # Add log
        import uuid
        self.logs.append(
            PurchaseOrderApprovalLog(
                id=str(uuid.uuid4()),
                status="REJECTED",
                actor=actor,
                action_date=datetime.now(),
                reason=reason,
                comments=comments,
            )
        )
