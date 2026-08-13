"""
Domain events for the procurement module.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import uuid


@dataclass(frozen=True)
class PurchaseOrderCreatedEvent:
    po_id: uuid.UUID
    po_number: str
    status: str
    supplier_name: str | None
    warehouse_id: str | None
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class PurchaseOrderDraftSavedEvent:
    po_id: uuid.UUID
    po_number: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class PurchaseOrderUpdatedEvent:
    po_id: uuid.UUID
    po_number: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class PurchaseOrderCancelledEvent:
    po_id: uuid.UUID
    po_number: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class MaterialRequestCreatedEvent:
    request_id: str
    request_number: str
    warehouse_id: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class RFQPublishedEvent:
    rfq_id: str
    rfq_number: str
    title: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class SupplierQuotationSubmittedEvent:
    quotation_id: str
    quotation_number: str
    rfq_id: str
    supplier_id: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class SupplierSelectedEvent:
    rfq_id: str
    quotation_id: str
    supplier_id: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class FinanceApprovedEvent:
    approval_id: str
    po_id: str
    po_number: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class SupplierASNSubmittedEvent:
    asn_id: str
    asn_number: str
    po_id: str
    vehicle_number: str
    status: str
    occurred_at: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class ArrivalNotificationDispatchedEvent:
    notification_id: str
    asn_id: str
    po_id: str
    vehicle_number: str
    warehouse_id: str
    occurred_at: datetime = datetime.now(timezone.utc)
