"""
ConfirmGrnUseCase / GetGrnUseCase - counterparts of the Java use cases.
Orchestrates one transaction: look up the PO, ask the domain layer to
confirm the receipt, save it. The only "framework" dependency this layer
has is the UnitOfWork it's handed - wiring and transaction boundaries,
never business rules.
"""
from __future__ import annotations

from app.modules.receiving.application.commands import ConfirmGrnCommand
from app.modules.receiving.application.exceptions import PurchaseOrderNotFoundException
from app.modules.receiving.application.repository import GrnRepository
from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.receipt_line import ReceiptLine
from app.modules.receiving.domain.value_objects import GrnId, PurchaseOrderId
from app.common.domain.exceptions import NotFoundException


class ConfirmGrnUseCase:
    def __init__(self, grn_repository: GrnRepository) -> None:
        self._grn_repository = grn_repository

    async def handle(self, command: ConfirmGrnCommand) -> GrnId:
        po_id = PurchaseOrderId.of(command.po_id)
        po = await self._grn_repository.find_purchase_order(po_id)
        if po is None:
            raise PurchaseOrderNotFoundException(command.po_id)

        lines = [
            ReceiptLine(
                item_code=l.item_code,
                received_quantity=l.quantity,
                ordered_quantity=po.ordered_quantity_by_item_code.get(l.item_code),
            )
            for l in command.lines
        ]

        grn = GoodsReceiptNote.confirm(po_id, lines)
        await self._grn_repository.save(grn)
        return grn.id


class GetGrnUseCase:
    def __init__(self, grn_repository: GrnRepository) -> None:
        self._grn_repository = grn_repository

    async def handle(self, grn_id: GrnId) -> GoodsReceiptNote:
        grn = await self._grn_repository.find_by_id(grn_id)
        if grn is None:
            raise NotFoundException(f"GRN not found: {grn_id}")
        return grn
