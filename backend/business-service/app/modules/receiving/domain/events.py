"""
GoodsReceivedEvent - counterpart of GoodsReceivedEvent.java. Raised once,
when a GoodsReceiptNote is confirmed. Every downstream effect (inventory
update, quality inspection task, notification, ERP sync) reacts to this
event instead of being called directly.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.common.domain.events import DomainEvent


@dataclass(frozen=True)
class ReceivedLine:
    item_code: str
    quantity: Decimal


@dataclass(frozen=True, kw_only=True)
class GoodsReceivedEvent(DomainEvent):
    grn_id: str
    po_id: str
    lines: list[ReceivedLine]


@dataclass(frozen=True)
class PostedInventoryLine:
    item_code: str
    material_name: str
<<<<<<< HEAD
    quantity: float | Decimal
    uom: str = "PCS"
=======
    quantity: Decimal | float | int
    uom: str
>>>>>>> origin/main


@dataclass(frozen=True, kw_only=True)
class GrnPostedEvent(DomainEvent):
    grn_id: str
<<<<<<< HEAD
    grn_number: str
=======
    grn_number: str | None = None
>>>>>>> origin/main
    po_number: str | None = None
    asn_number: str | None = None
    supplier_name: str | None = None
    warehouse_id: str | None = None
    lines: list[PostedInventoryLine]

