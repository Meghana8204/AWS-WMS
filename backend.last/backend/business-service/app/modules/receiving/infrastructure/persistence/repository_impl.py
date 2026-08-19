"""
SqlAlchemyGrnRepository - the only class in this module that knows
PostgreSQL exists. Implements the GrnRepository port defined in the
application layer, counterpart of JpaGrnRepository.java. save() writes the
GRN and its outbox event(s) in one local transaction (the session managed
by the caller's UnitOfWork) - the outbox pattern from the original design.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.events.outbox_repository import to_outbox_row
from app.modules.receiving.application.repository import GrnRepository, PurchaseOrderSnapshot
from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.grn_status import GrnStatus
from app.modules.receiving.domain.receipt_line import ReceiptLine
from app.modules.receiving.domain.value_objects import GrnId, PurchaseOrderId
from app.modules.receiving.infrastructure.persistence.models import (
    GrnLineModel,
    GrnModel,
    PurchaseOrderModel,
)


class SqlAlchemyGrnRepository(GrnRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_purchase_order(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrderSnapshot]:
        result = await self._session.execute(
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.lines))
            .where(PurchaseOrderModel.id == po_id.value)
        )
        po = result.scalar_one_or_none()
        if po is None:
            return None
        qty_by_item: dict[str, Decimal] = {l.item_code: l.ordered_quantity for l in po.lines}
        return PurchaseOrderSnapshot(id=PurchaseOrderId.of(po.id), ordered_quantity_by_item_code=qty_by_item)

    async def save(self, grn: GoodsReceiptNote) -> None:
        entity = GrnModel(id=grn.id.value, po_id=grn.po_id.value, status=grn.status.value)
        for line in grn.lines:
            entity.lines.append(
                GrnLineModel(
                    item_code=line.item_code,
                    received_quantity=line.received_quantity,
                    ordered_quantity=line.ordered_quantity,
                )
            )
        self._session.add(entity)

        # Same local transaction as the GRN write above - the outbox
        # pattern. If the commit fails, the GRN write rolls back too, so
        # the two never go out of sync.
        for event in grn.domain_events:
            self._session.add(to_outbox_row("GoodsReceiptNote", str(grn.id), event))

        await self._session.flush()

    async def find_by_id(self, grn_id: GrnId) -> Optional[GoodsReceiptNote]:
        result = await self._session.execute(
            select(GrnModel).options(selectinload(GrnModel.lines)).where(GrnModel.id == grn_id.value)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            return None
        lines = [
            ReceiptLine(item_code=l.item_code, received_quantity=l.received_quantity, ordered_quantity=l.ordered_quantity)
            for l in entity.lines
        ]
        return GoodsReceiptNote.rehydrate(
            GrnId.of(entity.id), PurchaseOrderId.of(entity.po_id), GrnStatus(entity.status), lines
        )
