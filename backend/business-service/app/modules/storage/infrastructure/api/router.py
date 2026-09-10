import datetime
import json
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.database.session import UnitOfWork, get_uow
from app.modules.procurement.infrastructure.persistence.models import (
    MaterialStockModel,
    NotificationModel,
)
from app.modules.storage.infrastructure.persistence.models import (
    HandlingUnitModel,
    InventoryLocationBalanceModel,
    PutawayMovementModel,
    PutawayTaskModel,
    StorageLocationModel,
)
from app.modules.store.infrastructure.persistence.models import (
    StoreBinModel,
    StoreManagerUserModel,
    StoreModel,
    StoreZoneModel,
)
from app.security.dependencies import CurrentUser, get_current_user, require_permission

router = APIRouter(prefix="/api/storage/putaway-tasks", tags=["storage"])


class LocationAssignmentRequest(BaseModel):
    store_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    bin_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None


class PutawayConfirmationRequest(BaseModel):
    material_scan: str
    location_scan: str
    quantity: Decimal


class StorageLocationCreateRequest(BaseModel):
    location_code: str = Field(min_length=1, max_length=64)
    warehouse_id: str = Field(min_length=1, max_length=64)
    store_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    zone: str = Field(min_length=1, max_length=128)
    rack: str = Field(min_length=1, max_length=64)
    bin: str = Field(min_length=1, max_length=64)
    capacity: Decimal = Field(gt=0)


class StorageLocationUpdateRequest(BaseModel):
    active: bool


def storage_location_response(location: StorageLocationModel) -> dict:
    capacity = location.capacity or Decimal("0")
    occupied = location.occupied_quantity or Decimal("0")
    return {
        "id": str(location.id),
        "location_code": location.location_code,
        "warehouse_id": location.warehouse_id,
        "store_id": str(location.store_id) if location.store_id else None,
        "zone_id": str(location.zone_id) if location.zone_id else None,
        "zone": location.zone,
        "rack": location.rack,
        "bin": location.bin,
        "capacity": float(capacity),
        "occupied_quantity": float(occupied),
        "available_capacity": float(capacity - occupied),
        "utilization_percent": float((occupied / capacity) * 100) if capacity else 0,
        "active": location.active,
    }


async def get_user_store_context(user: CurrentUser, uow: UnitOfWork) -> tuple[set[uuid.UUID], set[str]]:
    roles_upper = {r.upper() for r in (user.roles or [])}
    if "ADMIN" in roles_upper or "SUPERUSER" in roles_upper:
        return set(), set()

    store_ids: set[uuid.UUID] = set()
    store_codes: set[str] = set()

    raw_id = getattr(user, "store_id", None) or user.raw_claims.get("store_id")
    if raw_id:
        try:
            store_ids.add(uuid.UUID(str(raw_id)))
        except (ValueError, TypeError):
            pass

    raw_code = getattr(user, "store_code", None) or user.raw_claims.get("store_code")
    if raw_code:
        store_codes.add(str(raw_code).strip().upper())

    emp_id = user.raw_claims.get("employee_id") or user.subject or user.username
    if emp_id:
        st = await uow.session.execute(
            select(StoreManagerUserModel).where(
                or_(
                    func.lower(StoreManagerUserModel.employee_id) == str(emp_id).strip().lower(),
                    func.lower(StoreManagerUserModel.username) == str(emp_id).strip().lower(),
                )
            )
        )
        for sm in st.scalars().all():
            if sm.store_id:
                store_ids.add(sm.store_id)
            if getattr(sm, "store_code", None):
                store_codes.add(str(sm.store_code).strip().upper())

    if store_ids:
        s_res = await uow.session.execute(select(StoreModel).where(StoreModel.id.in_(store_ids)))
        for s in s_res.scalars().all():
            if s.store_code:
                store_codes.add(s.store_code.strip().upper())

    if store_codes:
        s_res = await uow.session.execute(select(StoreModel).where(func.upper(StoreModel.store_code).in_(store_codes)))
        for s in s_res.scalars().all():
            store_ids.add(s.id)

    return store_ids, store_codes


async def get_user_store_id(user: CurrentUser, uow: UnitOfWork) -> uuid.UUID | None:
    roles_upper = {r.upper() for r in (user.roles or [])}
    if "ADMIN" in roles_upper or "SUPERUSER" in roles_upper:
        return None

    sids, _ = await get_user_store_context(user, uow)
    return next(iter(sids), None)


def task_response(task: PutawayTaskModel) -> dict:
    return {
        "id": str(task.id),
        "task_number": task.task_number,
        "grn_id": str(task.grn_id),
        "grn_number": task.grn_number,
        "handling_unit_id": str(task.handling_unit_id) if task.handling_unit_id else None,
        "item_code": task.item_code,
        "material_name": task.material_name,
        "quantity": float(task.quantity),
        "uom": task.uom,
        "warehouse_id": task.warehouse_id,
        "source_location": task.source_location,
        "destination_store_id": str(task.destination_store_id) if task.destination_store_id else None,
        "destination_zone_id": str(task.destination_zone_id) if task.destination_zone_id else None,
        "destination_bin_id": str(task.destination_bin_id) if getattr(task, "destination_bin_id", None) else None,
        "destination_bin_code": getattr(task, "destination_bin_code", None),
        "destination_location_id": str(task.destination_location_id) if task.destination_location_id else None,
        "destination_zone": task.destination_zone,
        "destination_rack": task.destination_rack,
        "destination_bin": task.destination_bin,
        "location_assigned_by": task.location_assigned_by,
        "location_assigned_at": task.location_assigned_at.isoformat() if task.location_assigned_at else None,
        "started_by": task.started_by,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_by": task.completed_by,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "status": task.status,
        "created_by": task.created_by,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


def normalize_hu_scan(value: str) -> str:
    scanned = value.strip()
    if scanned.startswith("{"):
        try:
            payload = json.loads(scanned)
            return str(payload.get("hu_number") or payload.get("barcode_value") or payload.get("item_code") or "").strip()
        except (json.JSONDecodeError, AttributeError):
            return scanned
    for line in scanned.splitlines():
        label, separator, candidate = line.partition(":")
        if separator and label.strip().upper() in {"HU", "HANDLING UNIT", "HU NUMBER"}:
            return candidate.strip()
    return scanned


def normalize_zone_scan(value: str) -> dict[str, str | None]:
    scanned = value.strip()
    if scanned.startswith("{"):
        try:
            payload = json.loads(scanned)
            return {
                "bin_id": str(payload.get("bin_id") or "").strip() or None,
                "bin_code": str(payload.get("bin_code") or "").strip() or None,
                "zone_id": str(payload.get("zone_id") or "").strip() or None,
                "zone_code": str(payload.get("zone_code") or "").strip() or None,
                "store_id": str(payload.get("store_id") or "").strip() or None,
                "store_code": str(payload.get("store_code") or "").strip() or None,
                "raw": scanned,
            }
        except (json.JSONDecodeError, AttributeError):
            pass
    # If the scanned string is a valid UUID, classify it directly
    try:
        parsed_uuid = uuid.UUID(scanned)
        return {
            "bin_id": str(parsed_uuid),
            "bin_code": None,
            "zone_id": str(parsed_uuid),
            "zone_code": None,
            "store_id": None,
            "store_code": None,
            "raw": scanned,
        }
    except (ValueError, TypeError):
        pass
    return {
        "bin_id": None,
        "bin_code": scanned if scanned.upper().startswith("BIN-") else None,
        "zone_id": None,
        "zone_code": scanned,
        "store_id": None,
        "store_code": None,
        "raw": scanned,
    }


def handling_unit_response(unit: HandlingUnitModel, task: PutawayTaskModel | None = None) -> dict:
    return {
        "id": str(unit.id),
        "hu_number": unit.hu_number,
        "barcode_value": unit.barcode_value,
        "item_code": unit.item_code,
        "material_name": unit.material_name,
        "quantity": float(unit.quantity),
        "uom": unit.uom,
        "batch_number": unit.batch_number,
        "supplier_name": unit.supplier_name,
        "po_number": unit.po_number,
        "asn_number": unit.asn_number,
        "grn_number": unit.grn_number,
        "warehouse_id": unit.warehouse_id,
        "current_location": unit.current_location,
        "status": unit.status,
        "putaway_task_id": str(task.id) if task else None,
        "putaway_task_number": task.task_number if task else None,
        "destination_store_id": str(task.destination_store_id) if task and task.destination_store_id else None,
        "destination_zone_id": str(task.destination_zone_id) if task and task.destination_zone_id else None,
        "destination_location_id": str(task.destination_location_id) if task and task.destination_location_id else None,
        "destination": f"{task.warehouse_id} / {task.destination_zone} / {task.destination_rack} / {task.destination_bin}" if task and task.destination_bin else None,
    }


@router.get("")
async def list_putaway_tasks(
    store_id: uuid.UUID | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    roles_upper = {r.upper() for r in user.roles}
    query = select(PutawayTaskModel).order_by(PutawayTaskModel.created_at.desc())

    # Store Keepers / Store Managers are strictly scoped to their assigned Store
    if "STORE_KEEPER" in roles_upper or "STORE_MANAGER" in roles_upper:
        if "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper and "WAREHOUSE" not in roles_upper and "WAREHOUSE_MANAGER" not in roles_upper:
            user_store_id = await get_user_store_id(user, uow)
            if user_store_id:
                query = query.where(PutawayTaskModel.destination_store_id == user_store_id)
            else:
                return []
    elif store_id:
        query = query.where(PutawayTaskModel.destination_store_id == store_id)

    result = await uow.session.execute(query)
    return [task_response(task) for task in result.scalars().all()]


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
    return [storage_location_response(location) for location in result.scalars().all()]


@router.post("/locations", status_code=201)
async def create_storage_location(
    request: StorageLocationCreateRequest,
    _user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    values = {
        "location_code": request.location_code.strip().upper(),
        "warehouse_id": request.warehouse_id.strip().upper(),
        "store_id": request.store_id,
        "zone_id": request.zone_id,
        "zone": request.zone.strip(),
        "rack": request.rack.strip(),
        "bin": request.bin.strip(),
    }
    if any(value is None or (isinstance(value, str) and not value) for k, value in values.items() if k not in ("store_id", "zone_id")):
        raise HTTPException(status_code=422, detail="Location fields cannot be blank")

    existing = await uow.session.scalar(
        select(StorageLocationModel).where(
            (StorageLocationModel.location_code == values["location_code"])
            | (
                (StorageLocationModel.warehouse_id == values["warehouse_id"])
                & (StorageLocationModel.zone == values["zone"])
                & (StorageLocationModel.rack == values["rack"])
                & (StorageLocationModel.bin == values["bin"])
            )
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Storage location already exists")

    location = StorageLocationModel(
        **values,
        capacity=request.capacity,
        occupied_quantity=Decimal("0"),
        active=True,
    )
    uow.session.add(location)
    try:
        await uow.session.flush()
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="Storage location already exists") from error
    return storage_location_response(location)


@router.put("/locations/{location_id}")
async def update_storage_location(
    location_id: uuid.UUID,
    request: StorageLocationUpdateRequest,
    _user=Depends(require_permission("gate:approve")),
    uow: UnitOfWork = Depends(get_uow),
):
    location = await uow.session.get(StorageLocationModel, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail="Storage location not found")
    if not request.active and location.occupied_quantity > 0:
        raise HTTPException(status_code=409, detail="Occupied storage locations cannot be deactivated")
    location.active = request.active
    await uow.session.flush()
    return storage_location_response(location)


@router.get("/inventory-locations")
async def list_inventory_location_balances(
    material_code: str | None = None,
    store_id: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    user_store_id = await get_user_store_id(user, uow)
    roles_upper = {r.upper() for r in user.roles}
    is_store_user = ("STORE_MANAGER" in roles_upper or "STORE_KEEPER" in roles_upper) and not (
        "WAREHOUSE" in roles_upper or "ADMIN" in roles_upper or "SUPERUSER" in roles_upper
    )

    if is_store_user:
        if not user_store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Store context not found for user",
            )
        if store_id and str(user_store_id) != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot view inventory of another Store.",
            )
        target_store_id = user_store_id
    else:
        target_store_id = uuid.UUID(store_id) if store_id else None

    query = (
        select(InventoryLocationBalanceModel, StorageLocationModel)
        .join(StorageLocationModel, StorageLocationModel.id == InventoryLocationBalanceModel.storage_location_id)
    )
    if target_store_id:
        query = query.where(StorageLocationModel.store_id == target_store_id)
    if material_code:
        query = query.where(func.lower(InventoryLocationBalanceModel.material_code) == material_code.lower())
    result = await uow.session.execute(
        query.order_by(InventoryLocationBalanceModel.material_code, StorageLocationModel.location_code)
    )
    
    stores_result = await uow.session.execute(select(StoreModel))
    store_map = {s.id: s for s in stores_result.scalars().all()}
    zones_result = await uow.session.execute(select(StoreZoneModel))
    zone_map = {z.id: z for z in zones_result.scalars().all()}

    output = []
    for balance, location in result.all():
        store_obj = store_map.get(location.store_id) if location.store_id else None
        zone_obj = zone_map.get(location.zone_id) if location.zone_id else None
        output.append({
            "id": str(balance.id),
            "material_code": balance.material_code,
            "material_name": balance.material_name,
            "warehouse_id": balance.warehouse_id,
            "storage_location_id": str(location.id),
            "location_code": location.location_code,
            "store_id": str(location.store_id) if location.store_id else None,
            "store_code": store_obj.store_code if store_obj else None,
            "store_name": store_obj.store_name if store_obj else None,
            "zone_id": str(location.zone_id) if location.zone_id else None,
            "zone_code": zone_obj.zone_code if zone_obj else location.zone,
            "zone_name": zone_obj.zone_name if zone_obj else location.zone,
            "zone": location.zone,
            "rack": location.rack,
            "bin": location.bin,
            "quantity": float(balance.quantity),
            "available_quantity": float(balance.available_quantity),
            "uom": balance.uom,
            "last_putaway_task_id": str(balance.last_putaway_task_id),
            "last_grn_number": balance.last_grn_number,
            "updated_at": balance.updated_at.isoformat(),
        })
    return output


@router.get("/handling-units/{scan_value}")
async def get_handling_unit(
    scan_value: str,
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    roles_upper = {r.upper() for r in user.roles}
    allowed = (
        "WAREHOUSE" in roles_upper
        or "ADMIN" in roles_upper
        or "SUPERUSER" in roles_upper
        or "STORE_MANAGER" in roles_upper
        or "STORE_KEEPER" in roles_upper
        or "storage:read" in user.permissions
        or "putaway:execute" in user.permissions
        or "gate:read" in user.permissions
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Handling unit scanning requires Warehouse or Store personnel access",
        )

    normalized = normalize_hu_scan(scan_value)
    result = await uow.session.execute(select(HandlingUnitModel).where(
        (HandlingUnitModel.hu_number == normalized) | (HandlingUnitModel.barcode_value == normalized) | (HandlingUnitModel.item_code == normalized)
    ))
    unit = result.scalar_one_or_none()
    if unit is None:
        raise HTTPException(status_code=404, detail="Handling unit was not found")

    task_result = await uow.session.execute(select(PutawayTaskModel).where(PutawayTaskModel.handling_unit_id == unit.id))
    task = task_result.scalar_one_or_none()

    # Store isolation: If task is assigned to a specific store, verify Store Keeper belongs to it
    if task and task.destination_store_id and ("STORE_MANAGER" in roles_upper or "STORE_KEEPER" in roles_upper):
        if "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper and "WAREHOUSE" not in roles_upper and "WAREHOUSE_MANAGER" not in roles_upper:
            user_store_id = await get_user_store_id(user, uow)
            if user_store_id and task.destination_store_id != user_store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Handling unit belongs to a putaway task for another Store",
                )

    return handling_unit_response(unit, task)


@router.get("/{task_id}")
async def get_putaway_task(
    task_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    task = await uow.session.get(PutawayTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")

    roles_upper = {r.upper() for r in user.roles}
    if "STORE_KEEPER" in roles_upper or "STORE_MANAGER" in roles_upper:
        if "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper and "WAREHOUSE" not in roles_upper and "WAREHOUSE_MANAGER" not in roles_upper:
            user_store_id = await get_user_store_id(user, uow)
            if user_store_id and task.destination_store_id != user_store_id:
                raise HTTPException(status_code=403, detail="Access denied: Putaway task belongs to another Store")

    return task_response(task)


@router.put("/{task_id}/location")
async def assign_storage_location(
    task_id: uuid.UUID,
    request: LocationAssignmentRequest,
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """
    Warehouse assigns the destination Store to the Putaway task and triggers notification.
    """
    roles_upper = {r.upper() for r in user.roles}
    is_wh = "WAREHOUSE" in roles_upper or "WAREHOUSE_MANAGER" in roles_upper or "ADMIN" in roles_upper or "SUPERUSER" in roles_upper or "gate:approve" in user.permissions

    if not is_wh:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Warehouse personnel can assign destination Stores to Putaway tasks",
        )

    task = await uow.session.get(PutawayTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status in ("PUTAWAY_COMPLETED", "STORED"):
        raise HTTPException(status_code=409, detail="Completed putaway tasks cannot be reassigned")

    # Destination Store selection
    if request.store_id:
        store = await uow.session.get(StoreModel, request.store_id)
        if store is None or store.status.upper() != "ACTIVE":
            raise HTTPException(status_code=422, detail="Selected destination store is inactive or not found")

        zone = None
        if request.zone_id:
            zone = await uow.session.get(StoreZoneModel, request.zone_id)
            if zone is None or zone.status.upper() != "ACTIVE":
                raise HTTPException(status_code=422, detail="Selected destination zone is inactive or not found")
            if zone.store_id != store.id:
                raise HTTPException(status_code=422, detail=f"Zone '{zone.zone_code}' does not belong to Store '{store.store_code}'")

        bin_obj = None
        if request.bin_id:
            bin_obj = await uow.session.get(StoreBinModel, request.bin_id)
            if bin_obj is None or bin_obj.status.upper() != "ACTIVE":
                raise HTTPException(status_code=422, detail="Selected destination bin is inactive or not found")
            if zone and bin_obj.zone_id != zone.id:
                raise HTTPException(status_code=422, detail=f"Bin '{bin_obj.bin_code}' does not belong to Zone '{zone.zone_code}'")
            if bin_obj.store_id != store.id:
                raise HTTPException(status_code=422, detail=f"Bin '{bin_obj.bin_code}' does not belong to Store '{store.store_code}'")

        # Resolve or create a storage_location associated with this store, zone, and bin
        location = None
        if zone:
            loc_query = select(StorageLocationModel).where(
                StorageLocationModel.warehouse_id == task.warehouse_id,
                StorageLocationModel.active.is_(True),
                (StorageLocationModel.zone_id == zone.id) | (StorageLocationModel.zone == zone.zone_code),
                StorageLocationModel.capacity - StorageLocationModel.occupied_quantity >= task.quantity,
            )
            if bin_obj:
                loc_query = loc_query.where(StorageLocationModel.bin_id == bin_obj.id)
            loc_res = await uow.session.execute(loc_query)
            location = loc_res.scalars().first()

            if location is None:
                b_code = bin_obj.bin_code if bin_obj else "B01"
                r_code = bin_obj.rack if bin_obj and bin_obj.rack else "R01"
                loc_code = f"LOC-{store.store_code}-{zone.zone_code}-{b_code}"
                exist_res = await uow.session.execute(
                    select(StorageLocationModel).where(StorageLocationModel.location_code == loc_code)
                )
                location = exist_res.scalar_one_or_none()
                if location is None:
                    location = StorageLocationModel(
                        location_code=loc_code,
                        warehouse_id=task.warehouse_id,
                        store_id=store.id,
                        zone_id=zone.id,
                        bin_id=bin_obj.id if bin_obj else None,
                        zone=zone.zone_code,
                        rack=r_code,
                        bin=b_code,
                        capacity=bin_obj.capacity if bin_obj else Decimal("10000.0"),
                        occupied_quantity=bin_obj.occupied_quantity if bin_obj else Decimal("0.0"),
                        active=True,
                    )
                    uow.session.add(location)
                    await uow.session.flush()
                else:
                    location.store_id = store.id
                    location.zone_id = zone.id
                    if bin_obj:
                        location.bin_id = bin_obj.id
                    location.zone = zone.zone_code
                    location.active = True
                    await uow.session.flush()

        task.destination_store_id = store.id
        task.destination_zone_id = zone.id if zone else None
        task.destination_bin_id = bin_obj.id if bin_obj else None
        task.destination_bin_code = bin_obj.bin_code if bin_obj else None
        task.destination_location_id = location.id if location else None
        task.destination_zone = zone.zone_code if zone else None
        task.destination_rack = bin_obj.rack if bin_obj and bin_obj.rack else (location.rack if location else None)
        task.destination_bin = bin_obj.bin_code if bin_obj else (location.bin if location else None)
    elif request.location_id:
        location = await uow.session.get(StorageLocationModel, request.location_id)
        if location is None or not location.active:
            raise HTTPException(status_code=422, detail="Storage location is unavailable")
        if location.warehouse_id != task.warehouse_id:
            raise HTTPException(status_code=422, detail="Storage location belongs to a different warehouse")
        if location.capacity - location.occupied_quantity < task.quantity:
            raise HTTPException(status_code=409, detail="Storage location has insufficient available capacity")
        
        store = None
        if location.store_id:
            store = await uow.session.get(StoreModel, location.store_id)

        task.destination_location_id = location.id
        task.destination_store_id = location.store_id
        task.destination_zone_id = location.zone_id
        task.destination_bin_id = location.bin_id
        task.destination_bin_code = location.bin
        task.destination_zone = location.zone
        task.destination_rack = location.rack
        task.destination_bin = location.bin
    else:
        raise HTTPException(status_code=422, detail="Specify destination store_id or storage location_id")

    task.status = "ASSIGNED_TO_STORE"
    task.location_assigned_by = user.username
    task.location_assigned_at = datetime.datetime.now(datetime.timezone.utc)

    # Trigger Notification for the assigned Store / Store Keeper
    store_name_disp = store.store_name if store else "Designated Store"
    store_code_disp = store.store_code if store else "STORE"

    notif_msg = (
        f"Material {task.material_name} ({task.item_code}) x {task.quantity} {task.uom} "
        f"assigned to {store_name_disp} ({store_code_disp}) from GRN {task.grn_number}."
    )
    # Store-scoped notification
    if store and store.store_code:
        uow.session.add(
            NotificationModel(
                user_role=f"STR:{store.store_code}"[:32],
                title=f"New Putaway Task: {task.task_number}",
                message=notif_msg,
                link=f"/my-store?task={task.id}",
                is_read=False,
            )
        )
    # Role-based notification
    uow.session.add(
        NotificationModel(
            user_role="STORE_KEEPER",
            title=f"New Putaway Task: {task.task_number}",
            message=notif_msg,
            link=f"/my-store?task={task.id}",
            is_read=False,
        )
    )

    await uow.session.flush()
    return task_response(task)


@router.post("/{task_id}/start")
async def start_putaway(
    task_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    task = await uow.session.get(PutawayTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status in ("PUTAWAY_COMPLETED", "STORED"):
        raise HTTPException(status_code=409, detail="Putaway task is already completed")
    if task.status == "PUTAWAY_IN_PROGRESS":
        return task_response(task)

    roles_upper = {r.upper() for r in user.roles}
    if "STORE_KEEPER" in roles_upper or "STORE_MANAGER" in roles_upper:
        if "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper and "WAREHOUSE" not in roles_upper and "WAREHOUSE_MANAGER" not in roles_upper:
            user_store_id = await get_user_store_id(user, uow)
            if user_store_id and task.destination_store_id and task.destination_store_id != user_store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only start putaway tasks assigned to your Store",
                )

    task.status = "PUTAWAY_IN_PROGRESS"
    task.started_by = user.username
    task.started_at = datetime.datetime.now(datetime.timezone.utc)
    await uow.session.flush()
    return task_response(task)


@router.post("/{task_id}/complete")
async def complete_putaway(
    task_id: uuid.UUID,
    request: PutawayConfirmationRequest,
    user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """
    Store Keeper confirms physical Putaway by scanning Material QR & Zone/Bin QR.
    Updates Material Stock and Inventory balances to AVAILABLE at the Store, Zone, and Bin.
    """
    task = await uow.session.get(PutawayTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Putaway task not found")
    if task.status in ("PUTAWAY_COMPLETED", "STORED"):
        raise HTTPException(status_code=409, detail="Putaway task is already completed")

    roles_upper = {r.upper() for r in user.roles}
    # Store isolation & Separation of Duties: Physical Putaway confirmation into a Store is performed by Store Keeper/Manager
    if task.destination_store_id:
        if "STORE_KEEPER" not in roles_upper and "STORE_MANAGER" not in roles_upper and "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only Store Keepers assigned to this Store can complete physical putaway",
            )
        if "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper:
            user_store_id = await get_user_store_id(user, uow)
            if user_store_id and task.destination_store_id != user_store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot complete Putaway tasks belonging to another Store",
                )

    if task.status != "PUTAWAY_IN_PROGRESS":
        if task.status in ("ASSIGNED_TO_STORE", "PUTAWAY_PENDING") and task.destination_store_id:
            task.status = "PUTAWAY_IN_PROGRESS"
            task.started_by = user.username
            task.started_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            raise HTTPException(status_code=409, detail="Putaway task must be in progress")

    # 1. Validate Material QR
    scanned_hu = normalize_hu_scan(request.material_scan)
    handling_unit = None
    if task.handling_unit_id:
        hu_result = await uow.session.execute(
            select(HandlingUnitModel).where(
                HandlingUnitModel.id == task.handling_unit_id,
                (HandlingUnitModel.hu_number == scanned_hu)
                | (HandlingUnitModel.barcode_value == scanned_hu)
                | (HandlingUnitModel.item_code == scanned_hu),
            ).with_for_update()
        )
        handling_unit = hu_result.scalar_one_or_none()

    if handling_unit is None and scanned_hu.upper() != task.item_code.upper():
        raise HTTPException(status_code=422, detail="Scanned Material QR does not match the putaway task")

    if handling_unit and handling_unit.status in ("QUARANTINED", "REJECTED", "DAMAGED"):
        raise HTTPException(
            status_code=409,
            detail=f"Material is {handling_unit.status.lower()} and cannot be put away into storage",
        )

    # 2. Validate Location / Zone / Bin Scan
    loc_scan_info = normalize_zone_scan(request.location_scan)
    scanned_bin_id = loc_scan_info.get("bin_id")
    scanned_bin_code = loc_scan_info.get("bin_code")
    scanned_zone_id = loc_scan_info.get("zone_id")
    scanned_zone_code = loc_scan_info.get("zone_code")

    target_bin: StoreBinModel | None = None
    target_zone: StoreZoneModel | None = None

    # Step A: Try resolving Bin first
    if scanned_bin_id:
        try:
            target_bin = await uow.session.get(StoreBinModel, uuid.UUID(scanned_bin_id))
        except (ValueError, TypeError):
            pass

    if target_bin is None and scanned_bin_code:
        bq = await uow.session.execute(
            select(StoreBinModel).where(func.upper(StoreBinModel.bin_code) == scanned_bin_code.strip().upper())
        )
        target_bin = bq.scalar_one_or_none()

    if target_bin is not None:
        target_zone = await uow.session.get(StoreZoneModel, target_bin.zone_id)
    else:
        # Step B: If no bin matched directly, resolve Zone
        if scanned_zone_id:
            try:
                target_zone = await uow.session.get(StoreZoneModel, uuid.UUID(scanned_zone_id))
            except (ValueError, TypeError):
                pass

        if target_zone is None and scanned_zone_code:
            try:
                target_zone = await uow.session.get(StoreZoneModel, uuid.UUID(scanned_zone_code))
            except (ValueError, TypeError):
                pass

        if target_zone is None and scanned_zone_code:
            zq = await uow.session.execute(
                select(StoreZoneModel).where(func.upper(StoreZoneModel.zone_code) == scanned_zone_code.strip().upper())
            )
            target_zone = zq.scalar_one_or_none()

        if target_zone is None and task.destination_zone_id:
            target_zone = await uow.session.get(StoreZoneModel, task.destination_zone_id)

    if target_zone is None:
        raise HTTPException(status_code=422, detail="Scanned Zone/Bin location was not found")

    if target_zone.status.upper() != "ACTIVE":
        raise HTTPException(status_code=409, detail=f"Scanned Zone '{target_zone.zone_code}' is inactive")

    # STRICT STORE + ZONE VALIDATION: Scanned Zone must belong to target Store
    target_store = await uow.session.get(StoreModel, target_zone.store_id)
    if target_store is None:
        raise HTTPException(status_code=422, detail="Store associated with target zone was not found")
    if (target_store.status or "").strip().upper() != "ACTIVE":
        raise HTTPException(status_code=409, detail=f"Target Store '{target_store.store_code}' is inactive")

    # Validate Warehouse isolation
    if target_store.warehouse_id and task.warehouse_id and target_store.warehouse_id.strip().upper() != task.warehouse_id.strip().upper():
        raise HTTPException(
            status_code=422,
            detail=f"Store '{target_store.store_code}' belongs to warehouse '{target_store.warehouse_id}', which does not match task warehouse '{task.warehouse_id}'",
        )

    # Validate Store assignment matching if task has assigned store
    if task.destination_store_id and target_store.id != task.destination_store_id:
        raise HTTPException(
            status_code=422,
            detail=f"Scanned location belongs to Store '{target_store.store_code}', which does not belong to assigned destination Store",
        )

    # Validate User Store authorization
    if "ADMIN" not in roles_upper and "SUPERUSER" not in roles_upper:
        user_store_ids, user_store_codes = await get_user_store_context(user, uow)
        if user_store_ids or user_store_codes:
            if target_store.id not in user_store_ids and target_store.store_code.upper() not in user_store_codes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot complete Putaway tasks into another Store",
                )

    # Step C: If Bin was not explicitly scanned, locate or provision default Bin in the verified Zone
    if target_bin is None:
        bq = await uow.session.execute(
            select(StoreBinModel).where(
                StoreBinModel.zone_id == target_zone.id,
                StoreBinModel.status == "ACTIVE",
            ).order_by(StoreBinModel.bin_code.asc())
        )
        target_bin = bq.scalars().first()

    if target_bin is None:
        bin_code_clean = f"BIN-{target_zone.zone_code.replace(' ', '').upper()}-001"
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        target_bin = StoreBinModel(
            id=uuid.uuid4(),
            store_id=target_zone.store_id,
            zone_id=target_zone.id,
            bin_code=bin_code_clean,
            bin_name=f"{target_zone.zone_name} Primary Bin",
            rack="R01",
            shelf="S01",
            capacity=Decimal("10000.0"),
            occupied_quantity=Decimal("0.0"),
            status="ACTIVE",
            created_at=now_dt,
            updated_at=now_dt,
        )
        uow.session.add(target_bin)
        await uow.session.flush()

    # STRICT BIN VALIDATION
    if target_bin.status.upper() != "ACTIVE":
        raise HTTPException(status_code=409, detail=f"Target Bin '{target_bin.bin_code}' is inactive")
    if target_bin.zone_id != target_zone.id:
        raise HTTPException(status_code=422, detail=f"Target Bin '{target_bin.bin_code}' does not belong to Zone '{target_zone.zone_code}'")
    if task.destination_store_id and target_bin.store_id != task.destination_store_id:
        raise HTTPException(status_code=422, detail=f"Target Bin '{target_bin.bin_code}' does not belong to assigned destination Store")

    # 3. Resolve or Create Storage Location for the Store Zone + Bin
    location = None
    if task.destination_location_id:
        loc_res = await uow.session.execute(
            select(StorageLocationModel).where(StorageLocationModel.id == task.destination_location_id).with_for_update()
        )
        location = loc_res.scalar_one_or_none()

    if location is None:
        loc_res = await uow.session.execute(
            select(StorageLocationModel).where(
                StorageLocationModel.warehouse_id == task.warehouse_id,
                StorageLocationModel.store_id == target_zone.store_id,
                StorageLocationModel.zone_id == target_zone.id,
                StorageLocationModel.bin_id == target_bin.id,
                StorageLocationModel.active.is_(True),
            ).with_for_update()
        )
        location = loc_res.scalars().first()

    if location is None:
        store = await uow.session.get(StoreModel, target_zone.store_id)
        store_code = store.store_code if store else "STORE"
        loc_code = f"LOC-{store_code}-{target_zone.zone_code}-{target_bin.bin_code}"
        location = StorageLocationModel(
            location_code=loc_code,
            warehouse_id=task.warehouse_id,
            store_id=target_zone.store_id,
            zone_id=target_zone.id,
            bin_id=target_bin.id,
            zone=target_zone.zone_code,
            rack=target_bin.rack or "R01",
            bin=target_bin.bin_code,
            capacity=target_bin.capacity,
            occupied_quantity=target_bin.occupied_quantity,
            active=True,
        )
        uow.session.add(location)
        await uow.session.flush()

    if not location.active:
        raise HTTPException(status_code=409, detail="Assigned storage location is inactive")

    # 4. Quantity Validation
    if request.quantity <= 0:
        raise HTTPException(status_code=422, detail="Confirmed quantity must be greater than zero")
    if request.quantity > task.quantity:
        raise HTTPException(
            status_code=422,
            detail=f"Confirmed quantity ({request.quantity}) exceeds remaining task quantity ({task.quantity} {task.uom})",
        )
    if target_bin.occupied_quantity + request.quantity > target_bin.capacity:
        raise HTTPException(status_code=409, detail=f"Target Bin '{target_bin.bin_code}' has insufficient capacity")

    # 5. Material Stock Update (Available increments upon Putaway completion)
    stock_result = await uow.session.execute(
        select(MaterialStockModel).where(MaterialStockModel.material_code == task.item_code).with_for_update()
    )
    stock = stock_result.scalar_one_or_none()
    if stock is None or stock.warehouse_id != task.warehouse_id:
        raise HTTPException(status_code=409, detail="Matching warehouse inventory record was not found")

    prior = await uow.session.execute(select(PutawayMovementModel.id).where(PutawayMovementModel.putaway_task_id == task.id))
    if prior.first() is not None:
        raise HTTPException(status_code=409, detail="Putaway movement was already recorded")

    completed_at = datetime.datetime.now(datetime.timezone.utc)
    available_before = stock.available
    stock.available = stock.available + request.quantity
    stock.updated_at = completed_at.replace(tzinfo=None)
    target_bin.occupied_quantity = target_bin.occupied_quantity + request.quantity
    location.occupied_quantity = location.occupied_quantity + request.quantity

    # 6. Inventory Location Balance Update
    balance_result = await uow.session.execute(
        select(InventoryLocationBalanceModel).where(
            InventoryLocationBalanceModel.material_code == task.item_code,
            InventoryLocationBalanceModel.storage_location_id == location.id,
        ).with_for_update()
    )
    balance = balance_result.scalar_one_or_none()
    if balance is None:
        balance = InventoryLocationBalanceModel(
            material_code=task.item_code,
            material_name=task.material_name,
            warehouse_id=task.warehouse_id,
            storage_location_id=location.id,
            quantity=0,
            available_quantity=0,
            uom=task.uom,
            last_putaway_task_id=task.id,
            last_grn_number=task.grn_number,
            updated_at=completed_at,
        )
        uow.session.add(balance)
    balance.quantity = balance.quantity + request.quantity
    balance.available_quantity = balance.available_quantity + request.quantity
    balance.last_putaway_task_id = task.id
    balance.last_grn_number = task.grn_number
    balance.updated_at = completed_at

    # 7. Task and Handling Unit Completion
    task.destination_store_id = target_zone.store_id
    task.destination_zone_id = target_zone.id
    task.destination_zone = target_zone.zone_code
    task.destination_bin_id = target_bin.id
    task.destination_bin = target_bin.bin_code
    task.destination_bin_code = target_bin.bin_code
    task.destination_location_id = location.id
    task.status = "PUTAWAY_COMPLETED"
    task.completed_by = user.username
    task.completed_at = completed_at

    if handling_unit:
        dest_display = f"{target_zone.zone_code} / {target_bin.bin_code}"
        handling_unit.current_location = dest_display
        handling_unit.status = "STORED"
        handling_unit.updated_at = completed_at

    material_scan_record = (scanned_hu or request.material_scan.strip())[:64]
    location_scan_record = (target_bin.bin_code or target_zone.zone_code or request.location_scan.strip())[:64]

    uow.session.add(
        PutawayMovementModel(
            putaway_task_id=task.id,
            material_scan=material_scan_record,
            location_scan=location_scan_record,
            confirmed_quantity=request.quantity,
            uom=task.uom,
            inventory_available_before=available_before,
            inventory_available_after=stock.available,
            confirmed_by=user.username,
            confirmed_at=completed_at,
        )
    )
    await uow.session.flush()

    response = task_response(task)
    response["inventory_available_before"] = float(available_before)
    response["inventory_available_after"] = float(stock.available)
    return response
