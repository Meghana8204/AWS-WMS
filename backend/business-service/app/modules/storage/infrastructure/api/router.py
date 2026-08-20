import datetime
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.database.session import UnitOfWork, get_uow
from app.modules.procurement.infrastructure.persistence.models import MaterialStockModel
from app.modules.storage.infrastructure.persistence.models import InventoryLocationBalanceModel, PutawayMovementModel, PutawayTaskModel, StorageLocationModel
from app.security.dependencies import require_permission

router = APIRouter(prefix="/api/storage/putaway-tasks", tags=["storage"])


class LocationAssignmentRequest(BaseModel):
    location_id: uuid.UUID


class PutawayConfirmationRequest(BaseModel):
    material_scan: str
    location_scan: str
    quantity: Decimal


def task_response(task: PutawayTaskModel) -> dict:
    return {"id": str(task.id), "task_number": task.task_number, "grn_id": str(task.grn_id), "grn_number": task.grn_number,
            "item_code": task.item_code, "material_name": task.material_name, "quantity": float(task.quantity), "uom": task.uom,
            "warehouse_id": task.warehouse_id, "source_location": task.source_location,
            "destination_location_id": str(task.destination_location_id) if task.destination_location_id else None,
            "destination_zone": task.destination_zone, "destination_rack": task.destination_rack, "destination_bin": task.destination_bin,
            "location_assigned_by": task.location_assigned_by,
            "location_assigned_at": task.location_assigned_at.isoformat() if task.location_assigned_at else None,
            "started_by": task.started_by, "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_by": task.completed_by, "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "status": task.status, "created_by": task.created_by, "created_at": task.created_at.isoformat()}


@router.get("")
async def list_putaway_tasks(
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    result = await uow.session.execute(select(PutawayTaskModel).order_by(PutawayTaskModel.created_at.desc()))
    return [task_response(task) for task in result.scalars().all()]


@router.get("/locations")
async def list_storage_locations(
    warehouse_id: str | None = None,
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    query = select(StorageLocationModel).where(StorageLocationModel.active.is_(True))
    if warehouse_id:
        query = query.where(StorageLocationModel.warehouse_id == warehouse_id)
    result = await uow.session.execute(query.order_by(StorageLocationModel.warehouse_id, StorageLocationModel.zone, StorageLocationModel.rack, StorageLocationModel.bin))
    return [{"id": str(location.id), "location_code": location.location_code, "warehouse_id": location.warehouse_id,
             "zone": location.zone, "rack": location.rack, "bin": location.bin,
             "capacity": float(location.capacity), "occupied_quantity": float(location.occupied_quantity),
             "available_capacity": float(location.capacity - location.occupied_quantity), "active": location.active}
            for location in result.scalars().all()]


@router.get("/inventory-locations")
async def list_inventory_location_balances(
    material_code: str | None = None,
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    query = (select(InventoryLocationBalanceModel, StorageLocationModel)
             .join(StorageLocationModel, StorageLocationModel.id == InventoryLocationBalanceModel.storage_location_id))
    if material_code:
        query = query.where(InventoryLocationBalanceModel.material_code == material_code)
    result = await uow.session.execute(query.order_by(InventoryLocationBalanceModel.material_code, StorageLocationModel.location_code))
    return [{"id": str(balance.id), "material_code": balance.material_code, "material_name": balance.material_name,
             "warehouse_id": balance.warehouse_id, "storage_location_id": str(location.id), "location_code": location.location_code,
             "zone": location.zone, "rack": location.rack, "bin": location.bin,
             "quantity": float(balance.quantity), "available_quantity": float(balance.available_quantity), "uom": balance.uom,
             "last_putaway_task_id": str(balance.last_putaway_task_id), "last_grn_number": balance.last_grn_number,
             "updated_at": balance.updated_at.isoformat()}
            for balance, location in result.all()]


@router.put("/{task_id}/location")
async def assign_storage_location(
    task_id: uuid.UUID,
    request: LocationAssignmentRequest,
    user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    task = await uow.session.get(PutawayTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status != "PUTAWAY_PENDING":
        raise HTTPException(status_code=409, detail="Only pending putaway tasks can be assigned")
    location = await uow.session.get(StorageLocationModel, request.location_id)
    if location is None or not location.active:
        raise HTTPException(status_code=422, detail="Storage location is unavailable")
    if location.warehouse_id != task.warehouse_id:
        raise HTTPException(status_code=422, detail="Storage location belongs to a different warehouse")
    if location.capacity - location.occupied_quantity < task.quantity:
        raise HTTPException(status_code=409, detail="Storage location has insufficient available capacity")
    task.destination_location_id = location.id
    task.destination_zone = location.zone
    task.destination_rack = location.rack
    task.destination_bin = location.bin
    task.location_assigned_by = user.username
    task.location_assigned_at = datetime.datetime.now(datetime.timezone.utc)
    await uow.session.flush()
    return task_response(task)


@router.post("/{task_id}/start")
async def start_putaway(
    task_id: uuid.UUID,
    user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    result = await uow.session.execute(select(PutawayTaskModel).where(PutawayTaskModel.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status != "PUTAWAY_PENDING":
        raise HTTPException(status_code=409, detail="Only pending putaway tasks can be started")
    if task.destination_location_id is None:
        raise HTTPException(status_code=409, detail="Assign a destination location before starting putaway")
    task.status = "PUTAWAY_IN_PROGRESS"
    task.started_by = user.username
    task.started_at = datetime.datetime.now(datetime.timezone.utc)
    await uow.session.flush()
    return task_response(task)


@router.post("/{task_id}/complete")
async def complete_putaway(
    task_id: uuid.UUID,
    request: PutawayConfirmationRequest,
    user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    result = await uow.session.execute(select(PutawayTaskModel).where(PutawayTaskModel.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status != "PUTAWAY_IN_PROGRESS":
        raise HTTPException(status_code=409, detail="Putaway task must be in progress")
    if request.material_scan.strip().upper() != task.item_code.strip().upper():
        raise HTTPException(status_code=422, detail="Scanned material does not match the putaway task")
    location_result = await uow.session.execute(select(StorageLocationModel).where(StorageLocationModel.id == task.destination_location_id).with_for_update())
    location = location_result.scalar_one_or_none()
    if location is None or not location.active:
        raise HTTPException(status_code=409, detail="Assigned storage location is unavailable")
    if request.location_scan.strip().upper() != location.location_code.strip().upper():
        raise HTTPException(status_code=422, detail="Scanned location does not match the assigned destination")
    if request.quantity <= 0 or request.quantity != task.quantity:
        raise HTTPException(status_code=422, detail=f"Confirmed quantity must equal {task.quantity} {task.uom}")
    if location.occupied_quantity + request.quantity > location.capacity:
        raise HTTPException(status_code=409, detail="Storage location no longer has sufficient capacity")
    stock_result = await uow.session.execute(select(MaterialStockModel).where(MaterialStockModel.material_code == task.item_code).with_for_update())
    stock = stock_result.scalar_one_or_none()
    if stock is None or stock.warehouse_id != task.warehouse_id:
        raise HTTPException(status_code=409, detail="Matching warehouse inventory record was not found")
    prior = await uow.session.execute(select(PutawayMovementModel.id).where(PutawayMovementModel.putaway_task_id == task.id))
    if prior.first() is not None:
        raise HTTPException(status_code=409, detail="Putaway movement was already recorded")
    completed_at = datetime.datetime.now(datetime.timezone.utc)
    available_before = stock.available
    stock.available = stock.available + request.quantity
    stock.updated_at = completed_at
    location.occupied_quantity = location.occupied_quantity + request.quantity
    balance_result = await uow.session.execute(
        select(InventoryLocationBalanceModel).where(
            InventoryLocationBalanceModel.material_code == task.item_code,
            InventoryLocationBalanceModel.storage_location_id == location.id,
        ).with_for_update()
    )
    balance = balance_result.scalar_one_or_none()
    if balance is None:
        balance = InventoryLocationBalanceModel(
            material_code=task.item_code, material_name=task.material_name, warehouse_id=task.warehouse_id,
            storage_location_id=location.id, quantity=0, available_quantity=0, uom=task.uom,
            last_putaway_task_id=task.id, last_grn_number=task.grn_number, updated_at=completed_at,
        )
        uow.session.add(balance)
    balance.quantity = balance.quantity + request.quantity
    balance.available_quantity = balance.available_quantity + request.quantity
    balance.last_putaway_task_id = task.id
    balance.last_grn_number = task.grn_number
    balance.updated_at = completed_at
    task.status = "PUTAWAY_COMPLETED"
    task.completed_by = user.username
    task.completed_at = completed_at
    uow.session.add(PutawayMovementModel(
        putaway_task_id=task.id, material_scan=request.material_scan.strip(), location_scan=request.location_scan.strip(),
        confirmed_quantity=request.quantity, uom=task.uom,
        inventory_available_before=available_before, inventory_available_after=stock.available,
        confirmed_by=user.username, confirmed_at=completed_at,
    ))
    await uow.session.flush()
    response = task_response(task)
    response["inventory_available_before"] = float(available_before)
    response["inventory_available_after"] = float(stock.available)
    response["location_occupied_quantity"] = float(location.occupied_quantity)
    return response
