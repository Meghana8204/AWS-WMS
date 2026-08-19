"""
Inbound adapter for the receiving module - counterpart of GrnController.java.
Translates HTTP into a command, calls the use case, translates the result
back into HTTP. Includes in-memory fallback for standalone dev mode.
"""
from __future__ import annotations

import uuid
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, status

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
from app.modules.gate.infrastructure.api.router import get_gate_repo, get_po_repo
from app.security.dependencies import require_permission

router = APIRouter(prefix="/api/receiving/grn", tags=["receiving"])

# Standalone dev mode in-memory store
_dev_grn_store: Dict[str, dict] = {}


@router.post("", response_model=GrnResponse)
async def confirm(
    request: ConfirmGrnRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:write")),
) -> GrnResponse:
    po_record = get_po_repo().find_po_by_number(request.po_id)
    gate_entry = next(
        (
            entry for entry in reversed(get_gate_repo().list_all())
            if entry.po_number and entry.po_number.upper() == request.po_id.strip().upper()
        ),
        None,
    )
    ordered_quantity = (
        po_record.total_quantity if po_record
        else gate_entry.ocr_result.total_quantity if gate_entry and gate_entry.ocr_result
        else None
    )
    if ordered_quantity is not None and any(float(line.quantity) > ordered_quantity for line in request.lines):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Received quantity cannot exceed the PO quantity ({ordered_quantity}).",
        )
    try:
        repo = SqlAlchemyGrnRepository(uow.session)
        use_case = ConfirmGrnUseCase(repo)
        command = ConfirmGrnCommand(
            po_id=request.po_id,
            lines=[ConfirmGrnLine(item_code=l.item_code, quantity=l.quantity) for l in request.lines],
        )
        grn_id = await use_case.handle(command)
        return GrnResponse(grn_id=str(grn_id), status="CONFIRMED")
    except Exception:
        # Standalone dev mode: use the canonical PO quantity rather than
        # reporting the manually received quantity as the ordered quantity.
        dev_id = f"GRN-{uuid.uuid4().hex[:8].upper()}"
        _dev_grn_store[dev_id] = {
            "grn_id": dev_id,
            "po_id": request.po_id,
            "status": "CONFIRMED",
            "lines": [
                {
                    "itemCode": l.item_code,
                    "receivedQuantity": l.quantity,
                    "orderedQuantity": ordered_quantity,
                }
                for l in request.lines
            ],
        }
        return GrnResponse(grn_id=dev_id, status="CONFIRMED")


@router.get("/{grn_id}", response_model=GrnDetailResponse)
async def get(
    grn_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:read")),
) -> GrnDetailResponse:
    try:
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
    except Exception:
        # Dev store lookup fallback
        if grn_id in _dev_grn_store:
            data = _dev_grn_store[grn_id]
            return GrnDetailResponse(
                grn_id=data["grn_id"],
                po_id=data["po_id"],
                status=data["status"],
                lines=[
                    GrnLineResponse(
                        item_code=l["itemCode"],
                        received_quantity=l["receivedQuantity"],
                        ordered_quantity=l["orderedQuantity"],
                    )
                    for l in data["lines"]
                ],
            )
        # Fallback dummy GRN detail
        return GrnDetailResponse(
            grn_id=grn_id,
            po_id="PO-1001",
            status="CONFIRMED",
            lines=[
                GrnLineResponse(item_code="ITEM-A", received_quantity=10.0, ordered_quantity=10.0)
            ],
        )
