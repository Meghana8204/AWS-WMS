"""
Finance Approval Aggregate & Rule Engine.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
import uuid

# Threshold constant for mandatory Finance Approval (e.g. $50,000)
FINANCE_APPROVAL_THRESHOLD = Decimal("50000.00")


class FinanceApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


@dataclass
class FinanceApproval:
    id: str
    po_id: str
    po_number: str
    total_amount: Decimal
    requested_by: str
    budget_code: str | None = "DEFAULT-BUDGET"
    currency: str = "USD"
    status: FinanceApprovalStatus = FinanceApprovalStatus.PENDING
    approver_id: str | None = None
    approver_name: str | None = None
    approval_notes: str | None = None
    rejection_reason: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    recorded_events: list[object] = field(default_factory=list, repr=False)

    @classmethod
    def create(
        cls,
        po_id: str,
        po_number: str,
        total_amount: Decimal | float,
        requested_by: str,
        budget_code: str | None = "DEFAULT-BUDGET",
        currency: str = "USD",
        approval_id: str | None = None,
    ) -> "FinanceApproval":
        amt = Decimal(str(total_amount))
        return cls(
            id=approval_id or f"FA-{uuid.uuid4().hex[:8].upper()}",
            po_id=po_id,
            po_number=po_number,
            total_amount=amt,
            requested_by=requested_by,
            budget_code=budget_code,
            currency=currency,
            status=FinanceApprovalStatus.PENDING,
        )

    def approve(self, approver_id: str, approver_name: str, notes: str | None = None) -> None:
        if self.status != FinanceApprovalStatus.PENDING:
            raise ValueError(f"Cannot approve Finance Approval in status {self.status.value}")
        self.status = FinanceApprovalStatus.APPROVED
        self.approver_id = approver_id
        self.approver_name = approver_name
        self.approval_notes = notes
        self.updated_at = datetime.now(timezone.utc)

    def reject(self, approver_id: str, approver_name: str, reason: str) -> None:
        if self.status != FinanceApprovalStatus.PENDING:
            raise ValueError(f"Cannot reject Finance Approval in status {self.status.value}")
        if not reason or not reason.strip():
            raise ValueError("Rejection reason is required")
        self.status = FinanceApprovalStatus.REJECTED
        self.approver_id = approver_id
        self.approver_name = approver_name
        self.rejection_reason = reason
        self.updated_at = datetime.now(timezone.utc)

    @property
    def requires_cfo_approval(self) -> bool:
        return self.total_amount >= FINANCE_APPROVAL_THRESHOLD
