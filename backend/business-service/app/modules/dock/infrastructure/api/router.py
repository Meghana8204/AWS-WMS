from __future__ import annotations

from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import UnitOfWork, get_uow
from app.modules.dock.application.service import DockAllocationService
from app.modules.dock.infrastructure.api.schemas import (
    AllocateDockRequest,
    AllocationRequestResponse,
    AutoCreateAllocationRequest,
    CreateDockMasterRequest,
    DockAllocationHistoryResponse,
    DockMasterResponse,
    DockOverviewMetrics,
    ReassignDockRequest,
    UpdateDockMasterRequest,
    UpdateDockStatusRequest,
)
from app.modules.dock.infrastructure.persistence.models import (
    DockAllocationHistoryModel,
    DockAllocationRequestModel,
    DockMasterModel,
    DockStatusHistoryModel,
)
from app.security.dependencies import CurrentUser, require_permission

router = APIRouter(prefix="/api/v1/warehouse", tags=["dock-management"])


@router.get("/docks/availability", response_model=DockOverviewMetrics)
async def get_dock_availability(uow: UnitOfWork = Depends(get_uow)):
    metrics = await DockAllocationService.get_overview_metrics(uow.session)
    return metrics


@router.get("/docks", response_model=List[DockMasterResponse])
async def list_docks(
    dock_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    uow: UnitOfWork = Depends(get_uow),
):
    docks = await DockAllocationService.list_docks(uow.session, dock_type=dock_type, status=status_filter)
    dock_ids = [d.id for d in docks]
    alloc_map = await DockAllocationService.get_active_allocations_for_docks(uow.session, dock_ids)

    res = []
    for d in docks:
        alloc_req = alloc_map.get(d.id)
        current_alloc = None
        if alloc_req:
            current_alloc = AllocationRequestResponse(
                id=alloc_req.id,
                existing_gate_pass_id=alloc_req.existing_gate_pass_id,
                vendor_reference=alloc_req.vendor_reference,
                vehicle_number=alloc_req.vehicle_number,
                material_reference=alloc_req.material_reference,
                material_description=alloc_req.material_description,
                quantity=alloc_req.quantity,
                security_approved_at=alloc_req.security_approved_at,
                priority=alloc_req.priority,
                status=alloc_req.status,
                assigned_dock_id=alloc_req.assigned_dock_id,
                assigned_dock_code=d.dock_code,
                assigned_by=alloc_req.assigned_by,
                assigned_at=alloc_req.assigned_at,
                arrived_at=alloc_req.arrived_at,
                started_at=alloc_req.started_at,
                completed_at=alloc_req.completed_at,
                released_at=alloc_req.released_at,
                cancelled_at=alloc_req.cancelled_at,
                cancellation_reason=alloc_req.cancellation_reason,
                created_at=alloc_req.created_at,
                updated_at=alloc_req.updated_at,
            )
        res.append(
            DockMasterResponse(
                id=d.id,
                dock_code=d.dock_code,
                dock_name=d.dock_name,
                dock_type=d.dock_type,
                location=d.location,
                description=d.description,
                status=d.status,
                is_active=d.is_active,
                created_at=d.created_at,
                updated_at=d.updated_at,
                current_allocation=current_alloc,
            )
        )
    return res


@router.post("/docks", response_model=DockMasterResponse, status_code=status.HTTP_201_CREATED)
async def create_dock(
    req: CreateDockMasterRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    dock = DockMasterModel(
        dock_code=req.dock_code.strip().upper(),
        dock_name=req.dock_name.strip(),
        dock_type=req.dock_type.strip().upper(),
        location=req.location,
        description=req.description,
        status=req.status.upper(),
        is_active=req.is_active,
    )
    uow.session.add(dock)
    await uow.session.commit()
    return await get_dock_by_id(dock.id, uow)


@router.get("/docks/{dock_id}", response_model=DockMasterResponse)
async def get_dock_by_id(dock_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(
        select(DockMasterModel).where(DockMasterModel.id == dock_id)
    )
    dock = result.scalar_one_or_none()
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")

    alloc_map = await DockAllocationService.get_active_allocations_for_docks(uow.session, [dock.id])
    alloc_req = alloc_map.get(dock.id)
    current_alloc = None
    if alloc_req:
        current_alloc = AllocationRequestResponse(
            id=alloc_req.id,
            existing_gate_pass_id=alloc_req.existing_gate_pass_id,
            vendor_reference=alloc_req.vendor_reference,
            vehicle_number=alloc_req.vehicle_number,
            material_reference=alloc_req.material_reference,
            material_description=alloc_req.material_description,
            quantity=alloc_req.quantity,
            security_approved_at=alloc_req.security_approved_at,
            priority=alloc_req.priority,
            status=alloc_req.status,
            assigned_dock_id=alloc_req.assigned_dock_id,
            assigned_dock_code=dock.dock_code,
            assigned_by=alloc_req.assigned_by,
            assigned_at=alloc_req.assigned_at,
            arrived_at=alloc_req.arrived_at,
            started_at=alloc_req.started_at,
            completed_at=alloc_req.completed_at,
            released_at=alloc_req.released_at,
            cancelled_at=alloc_req.cancelled_at,
            cancellation_reason=alloc_req.cancellation_reason,
            created_at=alloc_req.created_at,
            updated_at=alloc_req.updated_at,
        )

    return DockMasterResponse(
        id=dock.id,
        dock_code=dock.dock_code,
        dock_name=dock.dock_name,
        dock_type=dock.dock_type,
        location=dock.location,
        description=dock.description,
        status=dock.status,
        is_active=dock.is_active,
        created_at=dock.created_at,
        updated_at=dock.updated_at,
        current_allocation=current_alloc,
    )


@router.put("/docks/{dock_id}", response_model=DockMasterResponse)
async def update_dock(
    dock_id: uuid.UUID,
    req: UpdateDockMasterRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    dock = (await uow.session.execute(select(DockMasterModel).where(DockMasterModel.id == dock_id))).scalar_one_or_none()
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")

    if req.dock_code is not None:
        dock.dock_code = req.dock_code.strip().upper()
    if req.dock_name is not None:
        dock.dock_name = req.dock_name.strip()
    if req.dock_type is not None:
        dock.dock_type = req.dock_type.strip().upper()
    if req.location is not None:
        dock.location = req.location
    if req.description is not None:
        dock.description = req.description
    if req.is_active is not None:
        dock.is_active = req.is_active

    await uow.session.commit()
    return await get_dock_by_id(dock.id, uow)


@router.patch("/docks/{dock_id}/status", response_model=DockMasterResponse)
async def update_dock_status(
    dock_id: uuid.UUID,
    req: UpdateDockStatusRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    dock = (await uow.session.execute(select(DockMasterModel).where(DockMasterModel.id == dock_id))).scalar_one_or_none()
    if not dock:
        raise HTTPException(status_code=404, detail="Dock not found")
    old_status = dock.status
    dock.status = req.status.upper()
    uow.session.add(
        DockStatusHistoryModel(
            dock_id=dock.id,
            previous_status=old_status,
            new_status=dock.status,
            reason=req.reason,
            changed_by=user.username,
        )
    )
    await uow.session.commit()
    return await get_dock_by_id(dock_id, uow)


@router.get("/dock-allocation-requests", response_model=List[AllocationRequestResponse])
async def list_allocation_requests(
    status_filter: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
):
    query = select(DockAllocationRequestModel).options(
        selectinload(DockAllocationRequestModel.assigned_dock),
    )
    if status_filter:
        query = query.where(DockAllocationRequestModel.status == status_filter.upper())
    query = query.order_by(
        desc(DockAllocationRequestModel.priority == "URGENT"),
        desc(DockAllocationRequestModel.priority == "HIGH"),
        desc(DockAllocationRequestModel.security_approved_at),
    )
    result = await uow.session.execute(query)
    reqs = result.scalars().all()
    res = []
    for r in reqs:
        res.append(
            AllocationRequestResponse(
                id=r.id,
                existing_gate_pass_id=r.existing_gate_pass_id,
                vendor_reference=r.vendor_reference,
                vehicle_number=r.vehicle_number,
                material_reference=r.material_reference,
                material_description=r.material_description,
                quantity=r.quantity,
                security_approved_at=r.security_approved_at,
                priority=r.priority,
                status=r.status,
                assigned_dock_id=r.assigned_dock_id,
                assigned_dock_code=r.assigned_dock.dock_code if r.assigned_dock else None,
                assigned_by=r.assigned_by,
                assigned_at=r.assigned_at,
                arrived_at=r.arrived_at,
                started_at=r.started_at,
                completed_at=r.completed_at,
                released_at=r.released_at,
                cancelled_at=r.cancelled_at,
                cancellation_reason=r.cancellation_reason,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )
    return res


@router.get("/dock-allocation-requests/pending", response_model=List[AllocationRequestResponse])
async def list_pending_allocation_requests(uow: UnitOfWork = Depends(get_uow)):
    await DockAllocationService.sync_pending_gate_entries(uow.session)
    query = (
        select(DockAllocationRequestModel)
        .options(selectinload(DockAllocationRequestModel.assigned_dock))
        .where(DockAllocationRequestModel.status.in_(["PENDING", "PENDING_ALLOCATION", "AWAITING_DOCK"]))
        .order_by(
            desc(DockAllocationRequestModel.priority == "URGENT"),
            desc(DockAllocationRequestModel.priority == "HIGH"),
            desc(DockAllocationRequestModel.security_approved_at),
        )
    )
    result = await uow.session.execute(query)
    reqs = result.scalars().all()
    return [
        AllocationRequestResponse(
            id=r.id,
            existing_gate_pass_id=r.existing_gate_pass_id,
            vendor_reference=r.vendor_reference,
            vehicle_number=r.vehicle_number,
            material_reference=r.material_reference,
            material_description=r.material_description,
            quantity=r.quantity,
            security_approved_at=r.security_approved_at,
            priority=r.priority,
            status=r.status,
            assigned_dock_id=r.assigned_dock_id,
            assigned_dock_code=r.assigned_dock.dock_code if r.assigned_dock else None,
            assigned_by=r.assigned_by,
            assigned_at=r.assigned_at,
            arrived_at=r.arrived_at,
            started_at=r.started_at,
            completed_at=r.completed_at,
            released_at=r.released_at,
            cancelled_at=r.cancelled_at,
            cancellation_reason=r.cancellation_reason,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in reqs
    ]


@router.post("/dock-allocation-requests/auto-create", response_model=AllocationRequestResponse, status_code=201)
async def auto_create_allocation_request(
    req: AutoCreateAllocationRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    created = await DockAllocationService.auto_create_allocation_request(
        session=uow.session,
        gate_pass_id=req.gate_pass_id,
        vehicle_number=req.vehicle_number,
        vendor_reference=req.vendor_reference,
        material_reference=req.material_reference,
        material_description=req.material_description,
        quantity=req.quantity,
        priority=req.priority,
    )
async def _build_allocation_response(
    session: AsyncSession, r: DockAllocationRequestModel
) -> AllocationRequestResponse:
    dock_code = None
    if r.assigned_dock_id:
        try:
            d = await session.get(DockMasterModel, r.assigned_dock_id)
            if d:
                dock_code = d.dock_code
        except Exception:
            dock_code = None
    return AllocationRequestResponse(
        id=r.id,
        existing_gate_pass_id=r.existing_gate_pass_id,
        vendor_reference=r.vendor_reference,
        vehicle_number=r.vehicle_number,
        material_reference=r.material_reference,
        material_description=r.material_description,
        quantity=r.quantity,
        security_approved_at=r.security_approved_at,
        priority=r.priority,
        status=r.status,
        assigned_dock_id=r.assigned_dock_id,
        assigned_dock_code=dock_code,
        assigned_by=r.assigned_by,
        assigned_at=r.assigned_at,
        arrived_at=r.arrived_at,
        started_at=r.started_at,
        completed_at=r.completed_at,
        released_at=r.released_at,
        cancelled_at=r.cancelled_at,
        cancellation_reason=r.cancellation_reason,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.post("/dock-allocation-requests/auto", response_model=AllocationRequestResponse, status_code=status.HTTP_201_CREATED)
async def auto_create_allocation_request(
    req: AutoCreateAllocationRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    created = await DockAllocationService.auto_create_allocation_request(
        session=uow.session,
        gate_pass_id=req.gate_pass_id,
        vehicle_number=req.vehicle_number,
        vendor_reference=req.vendor_reference,
        material_reference=req.material_reference,
        material_description=req.material_description,
        quantity=req.quantity,
        priority=req.priority,
    )
    return await _build_allocation_response(uow.session, created)


@router.post("/dock-allocations", response_model=AllocationRequestResponse)
async def allocate_dock(
    req: AllocateDockRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    allocated = await DockAllocationService.allocate_dock(
        session=uow.session,
        allocation_request_id=req.allocation_request_id,
        dock_id=req.dock_id,
        allocated_by=user.username,
    )
    return await _build_allocation_response(uow.session, allocated)


@router.patch("/dock-allocations/{id}/reassign", response_model=AllocationRequestResponse)
async def reassign_dock(
    id: uuid.UUID,
    req: ReassignDockRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    reassigned = await DockAllocationService.reassign_dock(
        session=uow.session,
        allocation_request_id=id,
        new_dock_id=req.new_dock_id,
        reassigned_by=user.username,
        reason=req.reason,
    )
    return await _build_allocation_response(uow.session, reassigned)


@router.post("/dock-allocations/{id}/arrive", response_model=AllocationRequestResponse)
async def mark_vehicle_arrived(
    id: uuid.UUID,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    arrived = await DockAllocationService.mark_vehicle_arrived(uow.session, id, user.username)
    return await _build_allocation_response(uow.session, arrived)


@router.post("/dock-allocations/{id}/start-receiving", response_model=AllocationRequestResponse)
async def start_receiving(
    id: uuid.UUID,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    req = await DockAllocationService.start_receiving(uow.session, id, user.username)
    return await _build_allocation_response(uow.session, req)


@router.post("/dock-allocations/{id}/complete", response_model=AllocationRequestResponse)
async def complete_receiving(
    id: uuid.UUID,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    req = await DockAllocationService.complete_receiving(uow.session, id, user.username)
    return await _build_allocation_response(uow.session, req)


@router.post("/dock-allocations/{id}/release", response_model=AllocationRequestResponse)
async def release_dock(
    id: uuid.UUID,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    released = await DockAllocationService.release_dock(uow.session, id, user.username)
    return await _build_allocation_response(uow.session, released)


@router.post("/dock-allocations/{id}/cancel", response_model=AllocationRequestResponse)
async def cancel_request(
    id: uuid.UUID,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
):
    req = await DockAllocationService.cancel_request(uow.session, id, user.username)
    return await _build_allocation_response(uow.session, req)


@router.get("/dock-history", response_model=List[DockAllocationHistoryResponse])
async def list_dock_history(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(
        select(DockAllocationHistoryModel)
        .order_by(desc(DockAllocationHistoryModel.performed_at))
        .limit(100)
    )
    histories = result.scalars().all()
    req_ids = [h.allocation_request_id for h in histories]
    req_map = {}
    if req_ids:
        r_res = await uow.session.execute(
            select(DockAllocationRequestModel).where(DockAllocationRequestModel.id.in_(req_ids))
        )
        req_map = {r.id: r for r in r_res.scalars().all()}

    dock_ids = [h.dock_id for h in histories if h.dock_id]
    dock_map = {}
    if dock_ids:
        d_res = await uow.session.execute(select(DockMasterModel).where(DockMasterModel.id.in_(dock_ids)))
        dock_map = {d.id: d.dock_code for d in d_res.scalars().all()}

    res = []
    for h in histories:
        r = req_map.get(h.allocation_request_id)
        res.append(
            DockAllocationHistoryResponse(
                id=h.id,
                allocation_request_id=h.allocation_request_id,
                existing_gate_pass_id=r.existing_gate_pass_id if r else None,
                vehicle_number=r.vehicle_number if r else None,
                vendor_reference=r.vendor_reference if r else None,
                dock_code=dock_map.get(h.dock_id),
                action=h.action,
                previous_status=h.previous_status,
                new_status=h.new_status,
                performed_by=h.performed_by,
                performed_at=h.performed_at,
                remarks=h.remarks,
            )
        )
    return res
