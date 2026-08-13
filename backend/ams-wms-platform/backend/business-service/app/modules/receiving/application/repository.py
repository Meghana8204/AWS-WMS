"""
GrnRepository - outbound port, counterpart of GrnRepository.java (interface).
The application layer below depends only on this Protocol; it has no idea
whether the implementation talks to PostgreSQL or anything else. Swapping
databases means writing a new implementation of this interface - nothing
in this file or in ConfirmGrnUseCase changes.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Protocol

from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.value_objects import GrnId, PurchaseOrderId


@dataclass(frozen=True)
class PurchaseOrderSnapshot:
    id: PurchaseOrderId
    ordered_quantity_by_item_code: dict[str, Decimal]


class GrnRepository(Protocol):
    async def find_purchase_order(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrderSnapshot]: ...

    async def save(self, grn: GoodsReceiptNote) -> None:
        """Persists the GRN and its raised domain events as outbox rows,
        in the same local database transaction."""
        ...

    async def find_by_id(self, grn_id: GrnId) -> Optional[GoodsReceiptNote]: ...
