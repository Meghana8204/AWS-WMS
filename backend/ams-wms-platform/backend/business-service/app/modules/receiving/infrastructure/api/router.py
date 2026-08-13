"""
Inbound adapter for the receiving module - counterpart of GrnController.java.
Translates HTTP into a command, calls the use case, translates the result
back into HTTP. No business rule is allowed to live in this file.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.database.session import UnitOfWork, get_uow
from app.modules.receiving.application.commands import ConfirmGrnCommand, ConfirmGrnLine
from app.modules.receiving.application.use_cases import ConfirmGrnUseCase, GetGrnUseCase
from app.modules.receiving.domain.value_objects import GrnId
from app.modules.receiving.infrastructure.api.schemas import (
    ConfirmGrnRequest,
    GrnDetailResponse,
    GrnLineResponse,
    GrnResponse,
)
from app.modules.receiving.infrastructure.persistence.repository_impl import SqlAlchemyGrnRepository
from app.security.dependencies import require_permission

router = APIRouter(prefix="/api/receiving/grn", tags=["receiving"])


@router.post("", response_model=GrnResponse)
async def confirm(
    request: ConfirmGrnRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:write")),
) -> GrnResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    use_case = ConfirmGrnUseCase(repo)
    command = ConfirmGrnCommand(
        po_id=request.po_id,
        lines=[ConfirmGrnLine(item_code=l.item_code, quantity=l.quantity) for l in request.lines],
    )
    grn_id = await use_case.handle(command)
    return GrnResponse(grn_id=str(grn_id), status="CONFIRMED")


@router.get("/{grn_id}", response_model=GrnDetailResponse)
async def get(
    grn_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:read")),
) -> GrnDetailResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    use_case = GetGrnUseCase(repo)
    grn = await use_case.handle(GrnId.of(grn_id))
    return GrnDetailResponse(
        grn_id=str(grn.id),
        po_id=str(grn.po_id),
        status=grn.status.value,
        lines=[
            GrnLineResponse(item_code=l.item_code, received_quantity=l.received_quantity, ordered_quantity=l.ordered_quantity)
            for l in grn.lines
        ],
    )
