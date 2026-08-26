import datetime
import json
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database.session import UnitOfWork, get_uow
from app.modules.receiving.infrastructure.persistence.models import GrnModel
from app.modules.procurement.infrastructure.persistence.models import MaterialStockModel, NotificationModel
from app.modules.storage.infrastructure.persistence.models import HandlingUnitModel, InventoryLocationBalanceModel, PutawayMovementModel, PutawayTaskModel, StorageLocationModel
from app.security.dependencies import require_permission

router = APIRouter(prefix="/api/storage/putaway-tasks", tags=["storage"])


class LocationAssignmentRequest(BaseModel):
    location_id: uuid.UUID


class OperatorAssignmentRequest(BaseModel):
    operator: str


class StorageLocationRequest(BaseModel):
    location_code: str = Field(min_length=1, max_length=64)
    warehouse_id: str = Field(min_length=1, max_length=64)
    zone: str = Field(min_length=1, max_length=128)
    rack: str = Field(min_length=1, max_length=64)
    bin: str = Field(min_length=1, max_length=64)
    capacity: Decimal = Field(gt=0)


class StorageLocationUpdateRequest(BaseModel):
    warehouse_id: str | None = Field(default=None, min_length=1, max_length=64)
    zone: str | None = Field(default=None, min_length=1, max_length=128)
    rack: str | None = Field(default=None, min_length=1, max_length=64)
    bin: str | None = Field(default=None, min_length=1, max_length=64)
    capacity: Decimal | None = Field(default=None, gt=0)
    active: bool | None = None


def location_response(location: StorageLocationModel) -> dict:
    return {
        "id": str(location.id), "location_code": location.location_code,
        "warehouse_id": location.warehouse_id, "zone": location.zone,
        "rack": location.rack, "bin": location.bin,
        "capacity": float(location.capacity),
        "occupied_quantity": float(location.occupied_quantity),
        "available_capacity": float(location.capacity - location.occupied_quantity),
        "utilization_percent": round(float(location.occupied_quantity / location.capacity * 100), 2),
        "active": location.active,
    }


class PutawayConfirmationRequest(BaseModel):
    material_scan: str
    location_scan: str
    material_code: str
    material_name: str
    source_location: str
    destination_location: str
    quantity: Decimal
    batch_lot: str | None = None
    serial_number: str | None = None
    container_pallet: str | None = None


def task_response(task: PutawayTaskModel, handling_unit: HandlingUnitModel | None = None) -> dict:
    destination = task.destination_bin or "the assigned bin"
    instruction = f"Put {task.quantity} {task.uom} {task.material_name} into {destination}"
    return {"id": str(task.id), "task_number": task.task_number, "grn_id": str(task.grn_id), "grn_number": task.grn_number,
            "handling_unit_id": str(task.handling_unit_id) if task.handling_unit_id else None,
            "handling_unit_number": handling_unit.hu_number if handling_unit else None,
            "handling_unit_barcode": handling_unit.barcode_value if handling_unit else None,
            "item_code": task.item_code, "material_name": task.material_name, "quantity": float(task.quantity), "uom": task.uom,
            "warehouse_id": task.warehouse_id, "source_location": task.source_location,
            "destination_location_id": str(task.destination_location_id) if task.destination_location_id else None,
            "destination_zone": task.destination_zone, "destination_rack": task.destination_rack, "destination_bin": task.destination_bin,
            "location_assigned_by": task.location_assigned_by,
            "location_assigned_at": task.location_assigned_at.isoformat() if task.location_assigned_at else None,
            "assigned_to": task.assigned_to, "assigned_by": task.assigned_by,
            "assigned_at": task.assigned_at.isoformat() if task.assigned_at else None,
            "material_category": task.material_category, "handling_requirement": task.handling_requirement,
            "rotation_policy": task.rotation_policy, "placement_metadata": task.placement_metadata,
            "movement_instruction": instruction,
            "started_by": task.started_by, "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_by": task.completed_by, "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "status": task.status, "created_by": task.created_by, "created_at": task.created_at.isoformat(),
            "audit_trail": build_audit_trail(task)}


def build_audit_trail(task: PutawayTaskModel, source: str | None = None, destination: str | None = None) -> list[dict]:
    source_label = source or task.source_location
    if "/" in source_label:
        source_label = source_label.rsplit("/", 1)[-1].strip()
    events = [{"status": "OPEN", "label": "Putaway Task Opened", "actor": task.created_by,
               "timestamp": task.created_at.isoformat(), "grn_number": task.grn_number}]
    if task.assigned_at:
        events.append({"status": "ASSIGNED", "label": "Assigned", "actor": task.assigned_by,
                       "operator": task.assigned_to, "timestamp": task.assigned_at.isoformat()})
    if task.started_at:
        events.append({"status": "PUTAWAY_IN_PROGRESS", "label": "Putaway In Progress",
                       "actor": task.started_by, "timestamp": task.started_at.isoformat()})
    if task.completed_at:
        events.append({"status": "PUTAWAY_COMPLETED", "label": "Putaway Completed",
                       "actor": task.completed_by, "timestamp": task.completed_at.isoformat(),
                       "source": source_label, "destination": destination or task.destination_bin,
                       "quantity": float(task.quantity), "uom": task.uom})
    return events


def normalize_hu_scan(value: str) -> str:
    scanned = value.strip()
    if scanned.startswith("{"):
        try:
            payload = json.loads(scanned)
            return str(payload.get("hu_number") or payload.get("barcode_value") or "").strip()
        except (json.JSONDecodeError, AttributeError):
            return scanned
    for line in scanned.splitlines():
        label, separator, candidate = line.partition(":")
        if separator and label.strip().upper() in {"HU", "HANDLING UNIT", "HU NUMBER"}:
            return candidate.strip()
    return scanned


def handling_unit_response(unit: HandlingUnitModel, task: PutawayTaskModel | None = None) -> dict:
    return {
        "id": str(unit.id), "hu_number": unit.hu_number, "barcode_value": unit.barcode_value,
        "item_code": unit.item_code, "material_name": unit.material_name, "quantity": float(unit.quantity),
        "uom": unit.uom, "batch_number": unit.batch_number, "supplier_name": unit.supplier_name,
        "po_number": unit.po_number, "asn_number": unit.asn_number, "grn_number": unit.grn_number,
        "warehouse_id": unit.warehouse_id, "current_location": unit.current_location, "status": unit.status,
        "putaway_task_id": str(task.id) if task else None, "putaway_task_number": task.task_number if task else None,
        "destination_location_id": str(task.destination_location_id) if task and task.destination_location_id else None,
        "destination": f"{task.warehouse_id} / {task.destination_zone} / {task.destination_rack} / {task.destination_bin}" if task and task.destination_bin else None,
    }


@router.get("")
async def list_putaway_tasks(
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    result = await uow.session.execute(
        select(PutawayTaskModel, GrnModel, StorageLocationModel, HandlingUnitModel)
        .join(GrnModel, GrnModel.id == PutawayTaskModel.grn_id)
        .outerjoin(StorageLocationModel, StorageLocationModel.id == PutawayTaskModel.destination_location_id)
        .outerjoin(HandlingUnitModel, HandlingUnitModel.id == PutawayTaskModel.handling_unit_id)
        .order_by(PutawayTaskModel.created_at.desc())
    )
    response = []
    for task, grn, location, handling_unit in result.all():
        item = task_response(task, handling_unit)
        item.update({"po_number": grn.po_number, "dock_number": grn.dock_number,
                     "source_location": f"Receiving / {grn.dock_number}"})
        if location is not None:
            item["destination_location_code"] = location.location_code
            item["movement_instruction"] = f"Put {task.quantity} {task.uom} {task.material_name} into {location.location_code}"
        item["audit_trail"] = build_audit_trail(task, grn.dock_number, location.location_code if location else None)
        response.append(item)
    return response


@router.put("/{task_id}/operator")
async def assign_operator(
    task_id: uuid.UUID,
    request: OperatorAssignmentRequest,
    user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    task = await uow.session.get(PutawayTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status != "OPEN":
        raise HTTPException(status_code=409, detail="Only open putaway tasks can be assigned")
    operator = request.operator.strip()
    if not operator:
        raise HTTPException(status_code=422, detail="Warehouse operator is required")
    if task.destination_location_id is None:
        raise HTTPException(status_code=409, detail="Assign a destination location before assigning an operator")
    location = await uow.session.get(StorageLocationModel, task.destination_location_id)
    if location is None:
        raise HTTPException(status_code=409, detail="Assigned destination location was not found")
    task.assigned_to = operator
    task.assigned_by = user.username
    task.assigned_at = datetime.datetime.now(datetime.timezone.utc)
    task.status = "ASSIGNED"
    instruction = f"Put {task.quantity} {task.uom} {task.material_name} into {location.location_code}"
    uow.session.add(NotificationModel(
        user_role="WAREHOUSE", title=f"Putaway task assigned to {operator}",
        message=f"{task.task_number}: {instruction}", link="/putaway-tasks",
    ))
    await uow.session.flush()
    response = task_response(task)
    response["destination_location_code"] = location.location_code
    response["movement_instruction"] = instruction
    return response


@router.get("/locations")
async def list_storage_locations(
    warehouse_id: str | None = None,
    include_inactive: bool = False,
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    query = select(StorageLocationModel)
    if not include_inactive:
        query = query.where(StorageLocationModel.active.is_(True))
    if warehouse_id:
        query = query.where(StorageLocationModel.warehouse_id == warehouse_id)
    result = await uow.session.execute(query.order_by(StorageLocationModel.warehouse_id, StorageLocationModel.zone, StorageLocationModel.rack, StorageLocationModel.bin))
    return [location_response(location) for location in result.scalars().all()]


@router.post("/locations", status_code=201)
async def create_storage_location(
    request: StorageLocationRequest,
    _user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    code = request.location_code.strip().upper()
    warehouse_id = request.warehouse_id.strip().upper()
    existing = await uow.session.execute(select(StorageLocationModel).where(StorageLocationModel.location_code == code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Storage location {code} already exists")
    location = StorageLocationModel(
        location_code=code, warehouse_id=warehouse_id, zone=request.zone.strip(),
        rack=request.rack.strip(), bin=request.bin.strip(), capacity=request.capacity,
        occupied_quantity=0, active=True,
    )
    uow.session.add(location)
    await uow.session.flush()
    return location_response(location)


@router.put("/locations/{location_id}")
async def update_storage_location(
    location_id: uuid.UUID,
    request: StorageLocationUpdateRequest,
    _user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    location = await uow.session.get(StorageLocationModel, location_id, with_for_update=True)
    if location is None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    if request.capacity is not None:
        if request.capacity < location.occupied_quantity:
            raise HTTPException(status_code=409, detail="Capacity cannot be below occupied quantity")
        location.capacity = request.capacity
    if request.warehouse_id is not None:
        if location.occupied_quantity > 0:
            raise HTTPException(status_code=409, detail="An occupied location cannot change warehouses")
        location.warehouse_id = request.warehouse_id.strip().upper()
    if request.zone is not None: location.zone = request.zone.strip()
    if request.rack is not None: location.rack = request.rack.strip()
    if request.bin is not None: location.bin = request.bin.strip()
    if request.active is not None:
        if not request.active and location.occupied_quantity > 0:
            raise HTTPException(status_code=409, detail="An occupied location cannot be deactivated")
        location.active = request.active
    await uow.session.flush()
    return location_response(location)


@router.get("/inventory-locations")
async def list_inventory_location_balances(
    material_code: str | None = None,
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    query = (select(InventoryLocationBalanceModel, StorageLocationModel)
             .join(StorageLocationModel, StorageLocationModel.id == InventoryLocationBalanceModel.storage_location_id)
             .where(InventoryLocationBalanceModel.quantity > 0, StorageLocationModel.active.is_(True)))
    if material_code:
        query = query.where(InventoryLocationBalanceModel.material_code == material_code)
    result = await uow.session.execute(query.order_by(InventoryLocationBalanceModel.material_code, StorageLocationModel.location_code))
    return [{"id": str(balance.id), "material_code": balance.material_code, "material_name": balance.material_name,
             "warehouse_id": balance.warehouse_id, "storage_location_id": str(location.id), "location_code": location.location_code,
             "zone": location.zone, "rack": location.rack, "bin": location.bin,
             "quantity": float(balance.quantity), "available_quantity": float(balance.available_quantity), "uom": balance.uom,
             "status": "ACTIVE", "stored": True,
             "last_putaway_task_id": str(balance.last_putaway_task_id), "last_grn_number": balance.last_grn_number,
             "updated_at": balance.updated_at.isoformat()}
            for balance, location in result.all()]


@router.get("/handling-units/{scan_value}")
async def get_handling_unit(
    scan_value: str,
    _user=Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    normalized = normalize_hu_scan(scan_value)
    result = await uow.session.execute(select(HandlingUnitModel).where(
        (HandlingUnitModel.hu_number == normalized) | (HandlingUnitModel.barcode_value == normalized)
    ))
    unit = result.scalar_one_or_none()
    if unit is None:
        raise HTTPException(status_code=404, detail="Handling unit was not found")
    task_result = await uow.session.execute(select(PutawayTaskModel).where(PutawayTaskModel.handling_unit_id == unit.id))
    return handling_unit_response(unit, task_result.scalar_one_or_none())


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
    if task.status != "OPEN":
        raise HTTPException(status_code=409, detail="Only open putaway tasks can be assigned a location")
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
    available = location.capacity - location.occupied_quantity
    metadata = dict(task.placement_metadata or {})
    metadata["score"] = metadata.get("score") or 100
    metadata["reasons"] = [
        f"Warehouse match: {location.warehouse_id}",
        f"Capacity available: {available}",
        f"Assigned location: {location.location_code}",
        f"{task.rotation_policy or 'FIFO'} stock rotation will apply",
    ]
    task.placement_metadata = metadata
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
    if task.status != "ASSIGNED":
        raise HTTPException(status_code=409, detail="Putaway task must be assigned before it can be started")
    if not task.assigned_to:
        raise HTTPException(status_code=409, detail="Assign a warehouse operator before starting putaway")
    grn = await uow.session.get(GrnModel, task.grn_id)
    if grn is None or grn.status != "GRN_POSTED":
        raise HTTPException(status_code=409, detail="GRN must be posted before putaway can start")
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
    scanned_hu = normalize_hu_scan(request.material_scan)
    hu_result = await uow.session.execute(select(HandlingUnitModel).where(
        HandlingUnitModel.id == task.handling_unit_id,
        (HandlingUnitModel.hu_number == scanned_hu) | (HandlingUnitModel.barcode_value == scanned_hu),
    ).with_for_update())
    handling_unit = hu_result.scalar_one_or_none()
    if handling_unit is None:
        raise HTTPException(status_code=422, detail="Scanned handling unit does not match the putaway task")
    location_result = await uow.session.execute(select(StorageLocationModel).where(StorageLocationModel.id == task.destination_location_id).with_for_update())
    location = location_result.scalar_one_or_none()
    if location is None or not location.active:
        raise HTTPException(status_code=409, detail="Assigned storage location is unavailable")
    if request.location_scan.strip().upper() != location.location_code.strip().upper():
        raise HTTPException(status_code=422, detail="Scanned location does not match the assigned destination")
    if request.material_code.strip().upper() != task.item_code.strip().upper():
        raise HTTPException(status_code=422, detail="Confirmed material code does not match the putaway task")
    if request.material_name.strip().casefold() != task.material_name.strip().casefold():
        raise HTTPException(status_code=422, detail="Confirmed material name does not match the putaway task")
    source_matches = request.source_location.strip().casefold() == task.source_location.strip().casefold()
    if task.source_location == "RECEIVING_AREA" and request.source_location.strip().casefold().startswith("receiving"):
        source_matches = True
    if not source_matches:
        raise HTTPException(status_code=422, detail="Confirmed source location does not match the putaway task")
    if request.destination_location.strip().upper() != location.location_code.strip().upper():
        raise HTTPException(status_code=422, detail="Confirmed destination location does not match the assigned bin")
    if handling_unit.batch_number and (request.batch_lot or "").strip().casefold() != handling_unit.batch_number.strip().casefold():
        raise HTTPException(status_code=422, detail="Confirmed batch/lot does not match the handling unit")
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
    # MaterialStockModel uses a timezone-naive legacy timestamp column.
    stock.updated_at = completed_at.replace(tzinfo=None)
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
    handling_unit.current_location = location.location_code
    handling_unit.status = "STORED"
    handling_unit.updated_at = completed_at
    uow.session.add(PutawayMovementModel(
        putaway_task_id=task.id, material_scan=request.material_scan.strip(), location_scan=request.location_scan.strip(),
        material_code=task.item_code, material_name=task.material_name,
        source_location=request.source_location.strip(), destination_location=location.location_code,
        batch_lot=(request.batch_lot or "").strip() or None,
        serial_number=(request.serial_number or "").strip() or None,
        container_pallet=(request.container_pallet or "").strip() or None,
        confirmed_quantity=request.quantity, uom=task.uom,
        inventory_available_before=available_before, inventory_available_after=stock.available,
        confirmed_by=user.username, confirmed_at=completed_at,
    ))
    await uow.session.flush()
    response = task_response(task)
    response["audit_trail"] = build_audit_trail(task, request.source_location.strip(), location.location_code)
    response["inventory_available_before"] = float(available_before)
    response["inventory_available_after"] = float(stock.available)
    response["location_occupied_quantity"] = float(location.occupied_quantity)
    response["inventory_update"] = {
        "material_code": task.item_code,
        "material_name": task.material_name,
        "warehouse_id": task.warehouse_id,
        "on_hand": float(stock.on_hand),
        "available": float(stock.available),
        "location": location.location_code,
        "location_id": str(location.id),
        "location_quantity": float(balance.quantity),
        "location_available": float(balance.available_quantity),
        "status": "ACTIVE",
        "updated_at": completed_at.isoformat(),
    }
    response["confirmation"] = {
        "material_code": task.item_code, "material_name": task.material_name,
        "quantity": float(request.quantity), "uom": task.uom,
        "source_location": request.source_location.strip(), "destination_location": location.location_code,
        "batch_lot": (request.batch_lot or "").strip() or None,
        "serial_number": (request.serial_number or "").strip() or None,
        "container_pallet": (request.container_pallet or "").strip() or None,
        "confirmed_by": user.username, "confirmed_at": completed_at.isoformat(),
    }
    return response
