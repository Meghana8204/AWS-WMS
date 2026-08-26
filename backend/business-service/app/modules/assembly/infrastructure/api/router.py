from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.database.session import UnitOfWork, get_uow
from app.modules.assembly.infrastructure.persistence.models import (
    AssemblyMaterialReservationModel,
    AssemblyMaterialConsumptionModel,
    AssemblyScrapModel,
    AssemblyQualityInspectionModel,
    AssemblyReworkOrderModel,
    AssemblyFinishedGoodsModel,
    AssemblyOrderModel,
    AssemblyTeamModel,
)
from app.modules.procurement.infrastructure.persistence.models import MaterialIssueModel, MaterialStockModel, NotificationModel, PickTaskModel
from app.modules.storage.infrastructure.persistence.models import HandlingUnitModel, PutawayMovementModel, StorageLocationModel

router = APIRouter(prefix="/api/v1/assembly", tags=["assembly"])

DEFAULT_ASSEMBLY_STEP_NAMES = [
    "Housing preparation", "PCB installation", "Cable connection",
    "Component installation", "Testing", "Final assembly",
]


def default_assembly_steps() -> list[dict]:
    return [{"id": str(index), "sequence": index, "name": name, "status": "NOT_STARTED", "started_at": None, "completed_at": None}
            for index, name in enumerate(DEFAULT_ASSEMBLY_STEP_NAMES, start=1)]


class AssemblyStatusUpdate(BaseModel):
    status: str
    assigned_line: str | None = None
    assigned_operator: str | None = None
    completed_quantity: Decimal | None = Field(default=None, ge=0)
    rejected_quantity: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class AssemblyOrderUpdate(BaseModel):
    product_name: str | None = Field(default=None, min_length=1, max_length=255)
    planned_quantity: Decimal | None = Field(default=None, gt=0)
    priority: str | None = None
    required_date: date | None = None
    assigned_team: str | None = None
    notes: str | None = None


class AssemblyStepUpdate(BaseModel):
    status: str


class AssemblyProgressUpdate(BaseModel):
    completed_quantity: Decimal = Field(ge=0)


class MaterialConsumptionUpdate(BaseModel):
    material_code: str = Field(min_length=1, max_length=64)
    expected_per_unit: Decimal = Field(gt=0)
    assembled_quantity: Decimal = Field(ge=0)
    actual_consumed: Decimal = Field(ge=0)
    uom: str = Field(default="PCS", min_length=1, max_length=32)


class AssemblyScrapCreate(BaseModel):
    material_code: str = Field(min_length=1, max_length=64)
    quantity: Decimal = Field(gt=0)
    uom: str = Field(default="PCS", min_length=1, max_length=32)
    reason: str = Field(min_length=1, max_length=1000)
    employee_team: str = Field(min_length=1, max_length=128)
    approval_required: bool = True


class AssemblyScrapApproval(BaseModel):
    approved_by: str = Field(min_length=1, max_length=128)


class AssemblyQualityInspectionUpdate(BaseModel):
    produced_quantity: Decimal = Field(gt=0)
    passed_quantity: Decimal = Field(ge=0)
    failed_quantity: Decimal = Field(ge=0)
    rework_quantity: Decimal = Field(ge=0)
    status: str
    inspected_by: str = Field(min_length=1, max_length=128)
    notes: str | None = Field(default=None, max_length=2000)
    product_code: str | None = Field(default=None, max_length=64)
    warehouse_id: str = Field(default="WH-01", min_length=1, max_length=64)
    location_code: str = Field(default="FG-A-03", min_length=1, max_length=64)


class AssemblyReworkCreate(BaseModel):
    assigned_team: str = Field(min_length=1, max_length=128)
    assigned_worker: str | None = Field(default=None, max_length=128)
    reason_for_failure: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=2000)


class AssemblyReworkUpdate(BaseModel):
    status: str
    assigned_team: str | None = Field(default=None, max_length=128)
    assigned_worker: str | None = Field(default=None, max_length=128)
    notes: str | None = Field(default=None, max_length=2000)


class AssemblyTeamRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    team_leader: str = Field(min_length=1, max_length=128)
    workers: list[str] = Field(default_factory=list)
    shift: str = Field(min_length=1, max_length=64)
    workstation: str = Field(min_length=1, max_length=64)
    active: bool = True


def serialize_team(team: AssemblyTeamModel, orders: list[AssemblyOrderModel]) -> dict:
    active_orders = [order for order in orders if order.assigned_team == team.name and order.status not in {"CLOSED", "COMPLETED", "QUALITY_CHECK"}]
    return {
        "id": str(team.id), "name": team.name, "team_leader": team.team_leader,
        "workers": team.workers or [], "workers_count": len(team.workers or []),
        "shift": team.shift, "workstation": team.workstation, "active": team.active,
        "assigned_orders": [{"id": str(order.id), "order_number": order.order_number,
                             "product_name": order.product_name, "target_quantity": float(order.planned_quantity),
                             "status": order.status} for order in active_orders],
        "current_workload": len(active_orders),
        "target_units": sum(float(order.planned_quantity) for order in active_orders),
        "created_at": team.created_at.isoformat(), "updated_at": team.updated_at.isoformat(),
    }


def calculate_assembly_progress(target: Decimal, completed: Decimal, status: str) -> dict:
    completed = min(max(completed, Decimal("0")), target)
    remaining = max(target - completed, Decimal("0"))
    percentage = round(float(completed / target * 100), 2) if target > 0 else 0.0
    progress_status = "COMPLETED" if status in {"COMPLETED", "QUALITY_CHECK", "CLOSED"} else (
        "PAUSED" if status == "ON_HOLD" else ("IN_PROGRESS" if status == "IN_PROGRESS" else "NOT_STARTED")
    )
    return {"target": float(target), "completed": float(completed), "remaining": float(remaining),
            "progress_percent": percentage, "progress_status": progress_status}


def calculate_material_variance(expected_per_unit: Decimal, assembled_quantity: Decimal, actual_consumed: Decimal) -> dict:
    expected = expected_per_unit * assembled_quantity
    variance = actual_consumed - expected
    variance_percent = round(float(variance / expected * 100), 2) if expected > 0 else 0.0
    status = "OVER_CONSUMPTION" if variance > 0 else ("UNDER_CONSUMPTION" if variance < 0 else "ON_TARGET")
    return {"expected_consumption": float(expected), "actual_consumption": float(actual_consumed),
            "variance_quantity": float(variance), "variance_percent": variance_percent, "status": status}


def validate_quality_quantities(produced: Decimal, passed: Decimal, failed: Decimal,
                                rework: Decimal, status: str) -> str:
    status = status.upper()
    allowed = {"PENDING_INSPECTION", "PASSED", "FAILED", "REWORK_REQUIRED"}
    if status not in allowed:
        raise ValueError(f"Quality status must be one of: {', '.join(sorted(allowed))}")
    if passed + failed + rework != produced:
        raise ValueError("Passed, failed, and rework quantities must equal produced quantity")
    if status == "PASSED" and (passed != produced or failed > 0 or rework > 0):
        raise ValueError("A passed inspection requires every produced unit to pass")
    if status == "FAILED" and failed <= 0:
        raise ValueError("A failed inspection requires at least one failed unit")
    if status == "REWORK_REQUIRED" and rework <= 0:
        raise ValueError("A rework inspection requires at least one rework unit")
    if status == "PENDING_INSPECTION":
        raise ValueError("Use a final inspection status when recording inspected quantities")
    return status


def serialize_quality(inspection: AssemblyQualityInspectionModel, order: AssemblyOrderModel) -> dict:
    return {
        "id": str(inspection.id), "assembly_order_id": str(order.id), "order_number": order.order_number,
        "product_name": order.product_name, "order_status": order.status,
        "produced_quantity": float(inspection.produced_quantity), "passed_quantity": float(inspection.passed_quantity),
        "failed_quantity": float(inspection.failed_quantity), "rework_quantity": float(inspection.rework_quantity),
        "status": inspection.status, "inspected_by": inspection.inspected_by, "notes": inspection.notes,
        "inspected_at": inspection.inspected_at.isoformat() if inspection.inspected_at else None,
        "created_at": inspection.created_at.isoformat(), "updated_at": inspection.updated_at.isoformat(),
    }


def serialize_rework(rework: AssemblyReworkOrderModel, order: AssemblyOrderModel) -> dict:
    return {
        "id": str(rework.id), "assembly_order_id": str(order.id), "assembly_order": order.order_number,
        "rework_number": rework.rework_number, "product_name": order.product_name,
        "reason_for_failure": rework.reason_for_failure, "failed_quantity": float(rework.failed_quantity),
        "assigned_team": rework.assigned_team, "assigned_worker": rework.assigned_worker,
        "status": rework.status, "final_result": rework.final_result, "notes": rework.notes,
        "created_at": rework.created_at.isoformat(),
        "started_at": rework.started_at.isoformat() if rework.started_at else None,
        "completed_at": rework.completed_at.isoformat() if rework.completed_at else None,
        "updated_at": rework.updated_at.isoformat(), "order_status": order.status,
    }


def serialize_finished_goods(record: AssemblyFinishedGoodsModel) -> dict:
    return {
        "id": str(record.id), "assembly_order_id": str(record.assembly_order_id),
        "product_code": record.product_code, "product_name": record.product_name,
        "quantity": float(record.quantity), "uom": record.uom, "status": record.status,
        "warehouse": record.warehouse_id, "location": record.location_code,
        "on_hand_before": float(record.on_hand_before), "on_hand_after": float(record.on_hand_after),
        "posted_at": record.posted_at.isoformat(), "updated_at": record.updated_at.isoformat(),
    }


def finished_good_code(product_name: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "-", product_name.upper()).strip("-")
    return f"FG-{slug}"[:64] or "FG-ASSEMBLED-PRODUCT"


async def add_assembly_notification(uow: UnitOfWork, title: str, message: str,
                                    order: AssemblyOrderModel | None = None) -> None:
    link = f"/assembly-orders?q={order.order_number}" if order else "/assembly-dashboard"
    exists = await uow.session.scalar(select(NotificationModel.id).where(
        NotificationModel.user_role == "ASSEMBLY_MANAGER",
        NotificationModel.title == title,
        NotificationModel.message == message,
    ))
    if not exists:
        uow.session.add(NotificationModel(
            id=uuid.uuid4(), user_role="ASSEMBLY_MANAGER", title=title, message=message,
            link=link, is_read=False, created_at=datetime.now(),
        ))


async def post_finished_goods(uow: UnitOfWork, order: AssemblyOrderModel, passed_quantity: Decimal,
                              product_code: str | None, warehouse_id: str, location_code: str,
                              now: datetime) -> AssemblyFinishedGoodsModel | None:
    if passed_quantity <= 0:
        return None
    code = (product_code or finished_good_code(order.product_name)).strip().upper()
    warehouse = warehouse_id.strip().upper()
    location_value = location_code.strip().upper()
    posting = await uow.session.scalar(select(AssemblyFinishedGoodsModel).where(
        AssemblyFinishedGoodsModel.assembly_order_id == order.id
    ).with_for_update())
    already_posted = posting.quantity if posting else Decimal("0")
    if passed_quantity < already_posted:
        raise HTTPException(status_code=409, detail="Passed quantity cannot be lower than finished goods already posted")
    if posting and (posting.product_code != code or posting.warehouse_id != warehouse or posting.location_code != location_value):
        raise HTTPException(status_code=409, detail="Finished goods destination cannot change after inventory posting")
    delta = passed_quantity - already_posted
    if delta <= 0:
        return posting
    stock = await uow.session.scalar(select(MaterialStockModel).where(
        MaterialStockModel.material_code == code
    ).with_for_update())
    if stock and stock.warehouse_id != warehouse:
        raise HTTPException(status_code=409, detail=f"Finished product {code} belongs to warehouse {stock.warehouse_id}")
    if not stock:
        stock = MaterialStockModel(
            id=uuid.uuid4(), material_code=code, material_name=order.product_name, category="FINISHED_GOODS",
            on_hand=Decimal("0"), allocated=Decimal("0"), available=Decimal("0"), uom="PCS",
            warehouse_id=warehouse, reorder_point=Decimal("0"), updated_at=now,
        )
        uow.session.add(stock)
        await uow.session.flush()
    before = stock.on_hand
    stock.on_hand += delta
    stock.available += delta
    stock.updated_at = now
    location = await uow.session.scalar(select(StorageLocationModel).where(
        StorageLocationModel.location_code == location_value,
        StorageLocationModel.warehouse_id == warehouse,
        StorageLocationModel.active.is_(True),
    ).with_for_update())
    if location:
        if location.occupied_quantity + delta > location.capacity:
            raise HTTPException(status_code=409, detail=f"Finished goods location {location_value} has insufficient capacity")
        location.occupied_quantity += delta
    if not posting:
        posting = AssemblyFinishedGoodsModel(
            id=uuid.uuid4(), assembly_order_id=order.id, product_code=code, product_name=order.product_name,
            quantity=passed_quantity, uom="PCS", status="AVAILABLE", warehouse_id=warehouse,
            location_code=location_value, on_hand_before=before, on_hand_after=stock.on_hand,
            posted_at=now, updated_at=now,
        )
        uow.session.add(posting)
    else:
        posting.quantity = passed_quantity
        posting.on_hand_after = stock.on_hand
        posting.updated_at = now
    await add_assembly_notification(
        uow, "Finished goods transferred to inventory",
        f"{delta:g} {posting.uom} of {order.product_name} from {order.order_number} posted to {warehouse} / {location_value}.",
        order,
    )
    return posting


def serialize_consumption(record: AssemblyMaterialConsumptionModel, material_name: str) -> dict:
    return {
        "id": str(record.id), "material_code": record.material_code, "material_name": material_name,
        "expected_per_unit": float(record.expected_per_unit), "assembled_quantity": float(record.assembled_quantity),
        "uom": record.uom, "recorded_by": record.recorded_by, "recorded_at": record.recorded_at.isoformat(),
        **calculate_material_variance(record.expected_per_unit, record.assembled_quantity, record.actual_consumed),
    }


def serialize_order(order: AssemblyOrderModel) -> dict:
    progress = calculate_assembly_progress(order.planned_quantity, order.completed_quantity, order.status)
    return {
        "id": str(order.id), "order_number": order.order_number,
        "material_request_id": str(order.material_request_id), "pick_task_id": str(order.pick_task_id),
        "material_issue_id": str(order.material_issue_id), "request_number": order.request_number,
        "department": order.department, "product_name": order.product_name, "items": order.items,
        "priority": order.priority, "required_date": order.required_date.isoformat() if order.required_date else None,
        "assigned_team": order.assigned_team, "materials_count": len(order.items or []),
        "assembly_steps": order.assembly_steps or default_assembly_steps(),
        "status": order.status, "planned_quantity": float(order.planned_quantity),
        "completed_quantity": float(order.completed_quantity), "rejected_quantity": float(order.rejected_quantity),
        "assigned_line": order.assigned_line, "assigned_operator": order.assigned_operator,
        "notes": order.notes, "created_by": order.created_by, "created_at": order.created_at.isoformat(),
        "started_at": order.started_at.isoformat() if order.started_at else None,
        "completed_at": order.completed_at.isoformat() if order.completed_at else None,
        "updated_at": order.updated_at.isoformat(),
        **progress,
    }


def aggregate_requirements(items: list) -> dict[str, dict]:
    """Combine duplicate component lines before checking or reserving stock."""
    requirements: dict[str, dict] = {}
    for item in items or []:
        material_code = (item.get("material_code") or "").strip()
        quantity = Decimal(str(item.get("quantity") or 0))
        if not material_code or quantity <= 0:
            continue
        requirement = requirements.setdefault(material_code, {"quantity": Decimal("0"), "item": item})
        requirement["quantity"] += quantity
    return requirements


def material_requirement_status(required: Decimal, free_stock: Decimal, reserved: Decimal) -> tuple[str, str]:
    if reserved >= required:
        return "RESERVED", "Reserved ✅"
    if free_stock >= required:
        return "AVAILABLE", "Available ✅"
    return "SHORTAGE", "Shortage ⚠️"


def build_material_issue_lines(requested_items: list, issued_items: list, batches_by_material: dict[str, set[str]] | None = None) -> list[dict]:
    requested = aggregate_requirements(requested_items)
    issued = aggregate_requirements(issued_items)
    batches_by_material = batches_by_material or {}
    lines = []
    for material_code, requirement in requested.items():
        item = requirement["item"]
        requested_qty = requirement["quantity"]
        issued_entry = issued.get(material_code)
        issued_item = issued_entry["item"] if issued_entry else {}
        issued_qty = issued_entry["quantity"] if issued_entry else Decimal("0")
        pending_qty = max(requested_qty - issued_qty, Decimal("0"))
        allocations = issued_item.get("allocations") or item.get("allocations") or []
        locations = sorted({allocation.get("location") for allocation in allocations if allocation.get("location")})
        explicit_batches = issued_item.get("batches") or item.get("batches") or []
        if isinstance(explicit_batches, str):
            explicit_batches = [explicit_batches]
        batches = sorted({str(value) for value in explicit_batches if value} | batches_by_material.get(material_code, set()))
        status = "ISSUED" if issued_qty >= requested_qty else ("PARTIALLY_ISSUED" if issued_qty > 0 else "PENDING")
        lines.append({
            "material_code": material_code, "material_name": item.get("material_name") or material_code,
            "requested_quantity": float(requested_qty), "issued_quantity": float(issued_qty),
            "pending_quantity": float(pending_qty), "uom": item.get("uom") or issued_item.get("uom") or "PCS",
            "batch_lot": batches, "storage_locations": locations, "status": status,
        })
    return lines


async def reserve_order_materials(uow: UnitOfWork, order: AssemblyOrderModel, reserved_at: datetime) -> list[dict]:
    existing_result = await uow.session.execute(
        select(AssemblyMaterialReservationModel).where(
            AssemblyMaterialReservationModel.assembly_order_id == order.id
        )
    )
    existing = existing_result.scalars().all()
    if existing:
        return [{
            "material_code": row.material_code, "reserved": float(row.quantity), "uom": row.uom,
        } for row in existing]

    requirements = aggregate_requirements(order.items or [])
    stocks: dict[str, MaterialStockModel] = {}
    shortages = []
    updates = []
    for material_code, requirement in requirements.items():
        stock = await uow.session.scalar(
            select(MaterialStockModel)
            .where(MaterialStockModel.material_code == material_code)
            .with_for_update()
        )
        required = requirement["quantity"]
        available = stock.available if stock else Decimal("0")
        if available < required:
            shortages.append({
                "material_code": material_code, "required": float(required),
                "available": float(available), "shortage": float(required - available),
            })
        elif stock:
            stocks[material_code] = stock

    if shortages:
        raise HTTPException(
            status_code=409,
            detail={"message": "Insufficient free stock to release assembly order", "shortages": shortages},
        )

    for material_code, requirement in requirements.items():
        stock = stocks[material_code]
        quantity = requirement["quantity"]
        stock.available -= quantity
        stock.allocated += quantity
        stock.updated_at = reserved_at
        item = requirement["item"]
        uow.session.add(AssemblyMaterialReservationModel(
            id=uuid.uuid4(), assembly_order_id=order.id, material_code=material_code,
            quantity=quantity, uom=item.get("uom") or stock.uom, status="RESERVED",
            reserved_by=order.created_by, reserved_at=reserved_at,
        ))
        updates.append({
            "material_code": material_code, "material_name": stock.material_name,
            "available": float(stock.on_hand), "reserved": float(quantity),
            "free_stock": float(stock.available), "uom": item.get("uom") or stock.uom,
        })
    return updates


async def create_order_for_issue(uow: UnitOfWork, task: PickTaskModel, issue: MaterialIssueModel) -> AssemblyOrderModel:
    existing = await uow.session.scalar(select(AssemblyOrderModel).where(AssemblyOrderModel.material_issue_id == issue.id))
    if existing:
        return existing
    now = datetime.now()
    count = await uow.session.scalar(select(func.count(AssemblyOrderModel.id))) or 0
    order = AssemblyOrderModel(
        id=uuid.uuid4(), order_number=f"AO-{now.year}-{count + 1:04d}", material_request_id=task.request_id,
        pick_task_id=task.id, material_issue_id=issue.id, request_number=task.request_number,
        department=task.department, product_name=task.department or "Assembly Order", items=task.items,
        status="DRAFT", priority="MEDIUM", required_date=None, assigned_team=None,
        assembly_steps=default_assembly_steps(),
        planned_quantity=Decimal("1"), completed_quantity=Decimal("0"),
        rejected_quantity=Decimal("0"), created_by=issue.received_by, created_at=now, updated_at=now,
    )
    uow.session.add(order)
    await uow.session.flush()
    await add_assembly_notification(uow, "New assembly order created",
                                    f"{order.order_number} was created for {order.product_name}.", order)
    await add_assembly_notification(uow, "Material issued",
                                    f"Materials for {order.order_number} were issued under {issue.issue_number}.", order)
    return order


async def backfill_issued_orders(uow: UnitOfWork) -> None:
    result = await uow.session.execute(select(MaterialIssueModel, PickTaskModel).join(PickTaskModel, PickTaskModel.id == MaterialIssueModel.pick_task_id))
    changed = False
    for issue, task in result.all():
        exists = await uow.session.scalar(select(AssemblyOrderModel.id).where(AssemblyOrderModel.material_issue_id == issue.id))
        if not exists:
            await create_order_for_issue(uow, task, issue)
            changed = True
    if changed:
        await uow.commit()


@router.get("/teams")
async def list_assembly_teams(uow: UnitOfWork = Depends(get_uow)):
    teams_result = await uow.session.execute(select(AssemblyTeamModel).order_by(AssemblyTeamModel.name))
    orders_result = await uow.session.execute(select(AssemblyOrderModel))
    orders = list(orders_result.scalars().all())
    return [serialize_team(team, orders) for team in teams_result.scalars().all()]


@router.post("/teams", status_code=201)
async def create_assembly_team(request: AssemblyTeamRequest, uow: UnitOfWork = Depends(get_uow)):
    name = request.name.strip()
    if await uow.session.scalar(select(AssemblyTeamModel.id).where(func.lower(AssemblyTeamModel.name) == name.lower())):
        raise HTTPException(status_code=409, detail="Assembly team name already exists")
    now = datetime.now()
    workers = list(dict.fromkeys(worker.strip() for worker in request.workers if worker.strip()))
    team = AssemblyTeamModel(
        id=uuid.uuid4(), name=name, team_leader=request.team_leader.strip(), workers=workers,
        shift=request.shift.strip(), workstation=request.workstation.strip().upper(), active=request.active,
        created_at=now, updated_at=now,
    )
    uow.session.add(team)
    await uow.commit()
    return serialize_team(team, [])


@router.patch("/teams/{team_id}")
async def update_assembly_team(team_id: uuid.UUID, request: AssemblyTeamRequest, uow: UnitOfWork = Depends(get_uow)):
    team = await uow.session.get(AssemblyTeamModel, team_id, with_for_update=True)
    if not team:
        raise HTTPException(status_code=404, detail="Assembly team not found")
    name = request.name.strip()
    duplicate = await uow.session.scalar(select(AssemblyTeamModel.id).where(
        func.lower(AssemblyTeamModel.name) == name.lower(), AssemblyTeamModel.id != team.id
    ))
    if duplicate:
        raise HTTPException(status_code=409, detail="Assembly team name already exists")
    old_name = team.name
    team.name = name
    team.team_leader = request.team_leader.strip()
    team.workers = list(dict.fromkeys(worker.strip() for worker in request.workers if worker.strip()))
    team.shift = request.shift.strip()
    team.workstation = request.workstation.strip().upper()
    team.active = request.active
    team.updated_at = datetime.now()
    orders_result = await uow.session.execute(select(AssemblyOrderModel).where(AssemblyOrderModel.assigned_team == old_name))
    orders = list(orders_result.scalars().all())
    for order in orders:
        order.assigned_team = name
    await uow.commit()
    return serialize_team(team, orders)


@router.get("/orders")
async def list_orders(uow: UnitOfWork = Depends(get_uow)):
    await backfill_issued_orders(uow)
    result = await uow.session.execute(select(AssemblyOrderModel).order_by(AssemblyOrderModel.created_at.desc()))
    return [serialize_order(order) for order in result.scalars().all()]


@router.get("/orders/{order_id}")
async def get_order(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    return serialize_order(order)


@router.patch("/orders/{order_id}")
async def update_order(order_id: uuid.UUID, request: AssemblyOrderUpdate, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    if order.status not in {"DRAFT", "RELEASED", "MATERIAL_CHECK", "READY"}:
        raise HTTPException(status_code=409, detail="Order details cannot be edited after assembly starts")
    if request.priority is not None:
        priority = request.priority.upper()
        if priority not in {"LOW", "MEDIUM", "HIGH", "URGENT"}:
            raise HTTPException(status_code=422, detail="Priority must be LOW, MEDIUM, HIGH, or URGENT")
        order.priority = priority
    if request.product_name is not None: order.product_name = request.product_name.strip()
    if request.planned_quantity is not None: order.planned_quantity = request.planned_quantity
    if request.required_date is not None: order.required_date = request.required_date
    if request.assigned_team is not None:
        assigned_team = request.assigned_team.strip() or None
        if assigned_team and not await uow.session.scalar(select(AssemblyTeamModel.id).where(
            AssemblyTeamModel.name == assigned_team, AssemblyTeamModel.active.is_(True)
        )):
            raise HTTPException(status_code=422, detail="Select an active assembly team")
        order.assigned_team = assigned_team
    if request.notes is not None: order.notes = request.notes.strip() or None
    order.updated_at = datetime.now()
    await uow.commit()
    return serialize_order(order)


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: uuid.UUID, request: AssemblyStatusUpdate, uow: UnitOfWork = Depends(get_uow)):
    transitions = {
        "DRAFT": {"RELEASED"}, "RELEASED": {"MATERIAL_CHECK"},
        "MATERIAL_CHECK": {"READY", "MATERIAL_SHORTAGE"}, "MATERIAL_SHORTAGE": {"MATERIAL_CHECK"},
        "READY": {"IN_PROGRESS"}, "IN_PROGRESS": {"COMPLETED", "ON_HOLD"},
        "ON_HOLD": {"IN_PROGRESS"}, "COMPLETED": {"QUALITY_CHECK"},
        "QUALITY_CHECK": {"CLOSED", "IN_PROGRESS"}, "CLOSED": set(),
    }
    status = request.status.upper()
    if status not in transitions:
        raise HTTPException(status_code=422, detail=f"Unknown assembly status: {status}")
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    current = order.status.upper()
    if status not in transitions.get(current, set()):
        next_values = ", ".join(sorted(transitions.get(current, set()))) or "none"
        raise HTTPException(status_code=409, detail=f"{current} can only move to: {next_values}")
    now = datetime.now()
    reservation_updates = []

    if status == "IN_PROGRESS" and not order.assigned_team:
        raise HTTPException(status_code=409, detail="Assign an assembly team before starting the work order")
    if status == "COMPLETED" and any(step.get("status") != "COMPLETED" for step in (order.assembly_steps or default_assembly_steps())):
        raise HTTPException(status_code=409, detail="Complete every assembly step before completing the work order")
    if current == "QUALITY_CHECK" and status in {"CLOSED", "IN_PROGRESS"}:
        inspection = await uow.session.scalar(select(AssemblyQualityInspectionModel).where(
            AssemblyQualityInspectionModel.assembly_order_id == order.id
        ))
        if not inspection:
            raise HTTPException(status_code=409, detail="Record the quality inspection result first")
        if status == "CLOSED" and inspection.status != "PASSED":
            raise HTTPException(status_code=409, detail="Only an order that passed quality inspection can be closed")
        if status == "IN_PROGRESS" and inspection.status not in {"FAILED", "REWORK_REQUIRED"}:
            raise HTTPException(status_code=409, detail="Only failed or rework-required inspections can return to assembly")
        if status == "IN_PROGRESS" and not await uow.session.scalar(select(AssemblyReworkOrderModel.id).where(
            AssemblyReworkOrderModel.assembly_order_id == order.id,
            AssemblyReworkOrderModel.status.in_({"PENDING", "IN_PROGRESS"}),
        )):
            raise HTTPException(status_code=409, detail="Create a rework order before returning the assembly to the team")

    if status == "RELEASED":
        reservation_updates = await reserve_order_materials(uow, order, now)

    # Automatic material check logic
    if status == "MATERIAL_CHECK":
        all_available = True
        reservation_result = await uow.session.execute(
            select(AssemblyMaterialReservationModel).where(
                AssemblyMaterialReservationModel.assembly_order_id == order.id,
                AssemblyMaterialReservationModel.status == "RESERVED",
            )
        )
        reservations = {row.material_code: row.quantity for row in reservation_result.scalars().all()}
        for material_code, requirement in aggregate_requirements(order.items or []).items():
            required_qty = requirement["quantity"]
            stock = await uow.session.scalar(
                select(MaterialStockModel).where(MaterialStockModel.material_code == material_code)
            )
            available_qty = (stock.available if stock else Decimal("0")) + reservations.get(material_code, Decimal("0"))
            if available_qty < required_qty:
                all_available = False
                break

        status = "READY" if all_available else "MATERIAL_SHORTAGE"

    order.status = status
    if request.assigned_line is not None: order.assigned_line = request.assigned_line.strip() or None
    if request.assigned_operator is not None: order.assigned_operator = request.assigned_operator.strip() or None
    if request.completed_quantity is not None: order.completed_quantity = request.completed_quantity
    if request.rejected_quantity is not None: order.rejected_quantity = request.rejected_quantity
    if request.notes is not None: order.notes = request.notes.strip() or None
    if status == "IN_PROGRESS" and not order.started_at: order.started_at = now
    if status == "COMPLETED":
        order.completed_at = now
        if request.completed_quantity is None: order.completed_quantity = order.planned_quantity
    if status == "QUALITY_CHECK":
        inspection = await uow.session.scalar(select(AssemblyQualityInspectionModel).where(
            AssemblyQualityInspectionModel.assembly_order_id == order.id
        ))
        if not inspection:
            inspection = AssemblyQualityInspectionModel(
                id=uuid.uuid4(), assembly_order_id=order.id, produced_quantity=order.completed_quantity,
                passed_quantity=Decimal("0"), failed_quantity=Decimal("0"), rework_quantity=Decimal("0"),
                status="PENDING_INSPECTION", created_at=now, updated_at=now,
            )
            uow.session.add(inspection)
        else:
            inspection.produced_quantity = order.completed_quantity
            inspection.passed_quantity = Decimal("0")
            inspection.failed_quantity = Decimal("0")
            inspection.rework_quantity = Decimal("0")
            inspection.status = "PENDING_INSPECTION"
            inspection.inspected_by = None
            inspection.notes = None
            inspection.inspected_at = None
            inspection.updated_at = now
        await add_assembly_notification(uow, "Quality inspection pending",
                                        f"{order.order_number} is awaiting finished assembly inspection.", order)
    if status == "MATERIAL_SHORTAGE":
        await add_assembly_notification(uow, "Material shortage",
                                        f"{order.order_number} cannot proceed because required material is short.", order)
    if status == "COMPLETED":
        await add_assembly_notification(uow, "Assembly completed",
                                        f"Assembly work for {order.order_number} is complete.", order)
    order.updated_at = now
    await uow.commit()
    response = serialize_order(order)
    if reservation_updates:
        response["reservation"] = {
            "status": "RESERVED", "materials": reservation_updates,
            "materials_count": len(reservation_updates), "reserved_at": now.isoformat(),
        }
    return response


@router.get("/orders/{order_id}/quality-inspection")
async def get_quality_inspection(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    inspection = await uow.session.scalar(select(AssemblyQualityInspectionModel).where(
        AssemblyQualityInspectionModel.assembly_order_id == order.id
    ))
    if not inspection:
        now = datetime.now()
        inspection = AssemblyQualityInspectionModel(
            id=uuid.uuid4(), assembly_order_id=order.id, produced_quantity=order.completed_quantity,
            passed_quantity=Decimal("0"), failed_quantity=Decimal("0"), rework_quantity=Decimal("0"),
            status="PENDING_INSPECTION", created_at=now, updated_at=now,
        )
        uow.session.add(inspection)
        await uow.commit()
    response = serialize_quality(inspection, order)
    finished_goods = await uow.session.scalar(select(AssemblyFinishedGoodsModel).where(
        AssemblyFinishedGoodsModel.assembly_order_id == order.id
    ))
    response["finished_goods"] = serialize_finished_goods(finished_goods) if finished_goods else None
    return response


@router.put("/orders/{order_id}/quality-inspection")
async def record_quality_inspection(order_id: uuid.UUID, request: AssemblyQualityInspectionUpdate,
                                    uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    if order.status != "QUALITY_CHECK":
        raise HTTPException(status_code=409, detail="Send the completed assembly order to quality before inspection")
    if request.produced_quantity != order.completed_quantity:
        raise HTTPException(status_code=422, detail="Produced quantity must match the completed assembly quantity")
    try:
        status = validate_quality_quantities(
            request.produced_quantity, request.passed_quantity, request.failed_quantity,
            request.rework_quantity, request.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    inspection = await uow.session.scalar(select(AssemblyQualityInspectionModel).where(
        AssemblyQualityInspectionModel.assembly_order_id == order.id
    ))
    now = datetime.now()
    if not inspection:
        inspection = AssemblyQualityInspectionModel(id=uuid.uuid4(), assembly_order_id=order.id, created_at=now)
        uow.session.add(inspection)
    inspection.produced_quantity = request.produced_quantity
    inspection.passed_quantity = request.passed_quantity
    inspection.failed_quantity = request.failed_quantity
    inspection.rework_quantity = request.rework_quantity
    inspection.status = status
    inspection.inspected_by = request.inspected_by.strip()
    inspection.notes = request.notes.strip() if request.notes and request.notes.strip() else None
    inspection.inspected_at = now
    inspection.updated_at = now
    order.rejected_quantity = request.failed_quantity
    order.updated_at = now
    latest_rework = await uow.session.scalar(select(AssemblyReworkOrderModel).where(
        AssemblyReworkOrderModel.assembly_order_id == order.id,
        AssemblyReworkOrderModel.status == "COMPLETED",
        AssemblyReworkOrderModel.final_result == "PENDING_INSPECTION",
    ).order_by(AssemblyReworkOrderModel.created_at.desc()))
    if latest_rework:
        latest_rework.final_result = status
        latest_rework.updated_at = now
    if status == "FAILED":
        await add_assembly_notification(uow, "Quality failed",
                                        f"{order.order_number} failed quality inspection for {request.failed_quantity:g} units.", order)
    if status == "REWORK_REQUIRED":
        await add_assembly_notification(uow, "Rework required",
                                        f"{order.order_number} requires rework for {request.rework_quantity:g} units.", order)
    finished_goods = await post_finished_goods(
        uow, order, request.passed_quantity, request.product_code,
        request.warehouse_id, request.location_code, now,
    )
    await uow.commit()
    response = serialize_quality(inspection, order)
    response["finished_goods"] = serialize_finished_goods(finished_goods) if finished_goods else None
    return response


@router.get("/finished-goods")
async def list_finished_goods(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(AssemblyFinishedGoodsModel).order_by(
        AssemblyFinishedGoodsModel.updated_at.desc()
    ))
    return [serialize_finished_goods(record) for record in result.scalars().all()]


@router.get("/orders/{order_id}/rework")
async def list_rework_orders(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    result = await uow.session.execute(select(AssemblyReworkOrderModel).where(
        AssemblyReworkOrderModel.assembly_order_id == order.id
    ).order_by(AssemblyReworkOrderModel.created_at.desc()))
    inspection = await uow.session.scalar(select(AssemblyQualityInspectionModel).where(
        AssemblyQualityInspectionModel.assembly_order_id == order.id
    ))
    return {"assembly_order_id": str(order.id), "order_number": order.order_number,
            "order_status": order.status, "quality_status": inspection.status if inspection else None,
            "records": [serialize_rework(row, order) for row in result.scalars().all()]}


@router.post("/orders/{order_id}/rework", status_code=201)
async def create_rework_order(order_id: uuid.UUID, request: AssemblyReworkCreate,
                              uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    inspection = await uow.session.scalar(select(AssemblyQualityInspectionModel).where(
        AssemblyQualityInspectionModel.assembly_order_id == order.id
    ))
    if order.status != "QUALITY_CHECK" or not inspection or inspection.status not in {"FAILED", "REWORK_REQUIRED"}:
        raise HTTPException(status_code=409, detail="A failed or rework-required quality inspection is required")
    if await uow.session.scalar(select(AssemblyReworkOrderModel.id).where(
        AssemblyReworkOrderModel.assembly_order_id == order.id,
        AssemblyReworkOrderModel.status.in_({"PENDING", "IN_PROGRESS"}),
    )):
        raise HTTPException(status_code=409, detail="An active rework order already exists")
    team = request.assigned_team.strip()
    if not await uow.session.scalar(select(AssemblyTeamModel.id).where(
        AssemblyTeamModel.name == team, AssemblyTeamModel.active.is_(True)
    )):
        raise HTTPException(status_code=422, detail="Select an active assembly team")
    count = await uow.session.scalar(select(func.count(AssemblyReworkOrderModel.id)).where(
        AssemblyReworkOrderModel.assembly_order_id == order.id
    )) or 0
    now = datetime.now()
    rework = AssemblyReworkOrderModel(
        id=uuid.uuid4(), assembly_order_id=order.id, rework_number=f"RW-{order.order_number}-{count + 1:02d}",
        reason_for_failure=(request.reason_for_failure or inspection.notes or inspection.status.replace("_", " ")).strip(),
        failed_quantity=inspection.failed_quantity + inspection.rework_quantity,
        assigned_team=team, assigned_worker=request.assigned_worker.strip() if request.assigned_worker else None,
        status="PENDING", final_result="PENDING_INSPECTION",
        notes=request.notes.strip() if request.notes else None, created_at=now, updated_at=now,
    )
    uow.session.add(rework)
    await add_assembly_notification(uow, "Rework required",
                                    f"{rework.rework_number} assigned to {rework.assigned_team} for {rework.failed_quantity:g} units.", order)
    await uow.commit()
    return serialize_rework(rework, order)


@router.patch("/orders/{order_id}/rework/{rework_id}")
async def update_rework_order(order_id: uuid.UUID, rework_id: uuid.UUID, request: AssemblyReworkUpdate,
                              uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    rework = await uow.session.get(AssemblyReworkOrderModel, rework_id, with_for_update=True)
    if not order or not rework or rework.assembly_order_id != order.id:
        raise HTTPException(status_code=404, detail="Rework order not found")
    status = request.status.upper()
    transitions = {"PENDING": {"IN_PROGRESS"}, "IN_PROGRESS": {"COMPLETED"}, "COMPLETED": set()}
    if status not in transitions.get(rework.status, set()):
        raise HTTPException(status_code=409, detail=f"{rework.status} cannot move to {status}")
    if status == "IN_PROGRESS" and order.status != "IN_PROGRESS":
        raise HTTPException(status_code=409, detail="Return the assembly order to rework before starting")
    now = datetime.now()
    if request.assigned_team is not None: rework.assigned_team = request.assigned_team.strip()
    if request.assigned_worker is not None: rework.assigned_worker = request.assigned_worker.strip() or None
    if request.notes is not None: rework.notes = request.notes.strip() or None
    rework.status = status
    if status == "IN_PROGRESS": rework.started_at = now
    if status == "COMPLETED":
        rework.completed_at = now
        order.status = "COMPLETED"
        order.completed_at = now
        order.updated_at = now
    rework.updated_at = now
    await uow.commit()
    return serialize_rework(rework, order)


@router.patch("/orders/{order_id}/steps/{step_id}")
async def update_assembly_step(order_id: uuid.UUID, step_id: str, request: AssemblyStepUpdate, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    if order.status not in {"IN_PROGRESS", "ON_HOLD"}:
        raise HTTPException(status_code=409, detail="Assembly work must be in progress before steps can be updated")
    status = request.status.upper()
    if status not in {"IN_PROGRESS", "COMPLETED"}:
        raise HTTPException(status_code=422, detail="Step status must be IN_PROGRESS or COMPLETED")
    steps = [dict(step) for step in (order.assembly_steps or default_assembly_steps())]
    index = next((position for position, step in enumerate(steps) if str(step.get("id")) == step_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="Assembly step not found")
    if index > 0 and steps[index - 1].get("status") != "COMPLETED":
        raise HTTPException(status_code=409, detail="Complete the previous assembly step first")
    if status == "COMPLETED" and steps[index].get("status") != "IN_PROGRESS":
        raise HTTPException(status_code=409, detail="Start the assembly step before completing it")
    now = datetime.now()
    steps[index]["status"] = status
    if status == "IN_PROGRESS" and not steps[index].get("started_at"):
        steps[index]["started_at"] = now.isoformat()
    if status == "COMPLETED":
        steps[index]["completed_at"] = now.isoformat()
    order.assembly_steps = steps
    order.updated_at = now
    await uow.commit()
    return serialize_order(order)


@router.patch("/orders/{order_id}/progress")
async def update_assembly_progress(order_id: uuid.UUID, request: AssemblyProgressUpdate, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    if order.status not in {"IN_PROGRESS", "ON_HOLD"}:
        raise HTTPException(status_code=409, detail="Progress can only be recorded for active or paused work orders")
    if request.completed_quantity > order.planned_quantity:
        raise HTTPException(status_code=422, detail="Completed quantity cannot exceed the work-order target")
    if request.completed_quantity < order.completed_quantity:
        raise HTTPException(status_code=409, detail="Completed quantity cannot be reduced")
    order.completed_quantity = request.completed_quantity
    order.updated_at = datetime.now()
    await uow.commit()
    return serialize_order(order)


@router.get("/orders/{order_id}/consumption")
async def get_material_consumption(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    result = await uow.session.execute(select(AssemblyMaterialConsumptionModel).where(
        AssemblyMaterialConsumptionModel.assembly_order_id == order.id
    ))
    records = {record.material_code: record for record in result.scalars().all()}
    lines = []
    for material_code, requirement in aggregate_requirements(order.items or []).items():
        item = requirement["item"]
        record = records.get(material_code)
        if record:
            lines.append(serialize_consumption(record, item.get("material_name") or material_code))
        else:
            expected_per_unit = requirement["quantity"] / order.planned_quantity if order.planned_quantity > 0 else Decimal("0")
            lines.append({
                "id": None, "material_code": material_code, "material_name": item.get("material_name") or material_code,
                "expected_per_unit": float(expected_per_unit), "assembled_quantity": float(order.completed_quantity),
                "expected_consumption": float(expected_per_unit * order.completed_quantity), "actual_consumption": None,
                "variance_quantity": None, "variance_percent": None, "status": "NOT_RECORDED",
                "uom": item.get("uom") or "PCS", "recorded_by": None, "recorded_at": None,
            })
    recorded = [line for line in lines if line["actual_consumption"] is not None]
    return {
        "order_number": order.order_number, "product_name": order.product_name, "order_status": order.status,
        "target_quantity": float(order.planned_quantity), "completed_quantity": float(order.completed_quantity),
        "summary": {
            "materials": len(lines), "recorded": len(recorded),
            "expected_consumption": sum(line["expected_consumption"] for line in recorded),
            "actual_consumption": sum(line["actual_consumption"] for line in recorded),
            "variance_quantity": sum(line["variance_quantity"] for line in recorded),
            "over_consumed_materials": sum(line["status"] == "OVER_CONSUMPTION" for line in recorded),
        },
        "materials": lines,
    }


@router.put("/orders/{order_id}/consumption")
async def record_material_consumption(order_id: uuid.UUID, request: MaterialConsumptionUpdate, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    if order.status not in {"IN_PROGRESS", "ON_HOLD", "COMPLETED", "QUALITY_CHECK"}:
        raise HTTPException(status_code=409, detail="Start assembly before recording material consumption")
    requirements = aggregate_requirements(order.items or [])
    material_code = request.material_code.strip()
    if material_code not in requirements:
        raise HTTPException(status_code=422, detail="Material is not required by this assembly order")
    if request.assembled_quantity > order.planned_quantity:
        raise HTTPException(status_code=422, detail="Assembled quantity cannot exceed the work-order target")
    result = await uow.session.execute(select(AssemblyMaterialConsumptionModel).where(
        AssemblyMaterialConsumptionModel.assembly_order_id == order.id,
        AssemblyMaterialConsumptionModel.material_code == material_code,
    ).with_for_update())
    record = result.scalar_one_or_none()
    now = datetime.now()
    if not record:
        record = AssemblyMaterialConsumptionModel(
            id=uuid.uuid4(), assembly_order_id=order.id, material_code=material_code,
            recorded_by=order.assigned_team or order.created_by, recorded_at=now, updated_at=now,
        )
        uow.session.add(record)
    record.expected_per_unit = request.expected_per_unit
    record.assembled_quantity = request.assembled_quantity
    record.actual_consumed = request.actual_consumed
    record.uom = request.uom.strip().upper()
    record.updated_at = now
    await uow.commit()
    item = requirements[material_code]["item"]
    return serialize_consumption(record, item.get("material_name") or material_code)


async def scrap_response(uow: UnitOfWork, order: AssemblyOrderModel, scrap: AssemblyScrapModel) -> dict:
    requirements = aggregate_requirements(order.items or [])
    requirement = requirements.get(scrap.material_code, {"quantity": Decimal("0"), "item": {}})
    consumption = await uow.session.scalar(select(AssemblyMaterialConsumptionModel).where(
        AssemblyMaterialConsumptionModel.assembly_order_id == order.id,
        AssemblyMaterialConsumptionModel.material_code == scrap.material_code,
    ))
    planned = consumption.expected_per_unit * consumption.assembled_quantity if consumption else requirement["quantity"]
    used = consumption.actual_consumed if consumption else max(planned - scrap.quantity, Decimal("0"))
    item = requirement["item"]
    return {
        "id": str(scrap.id), "assembly_order_id": str(order.id), "assembly_order": order.order_number,
        "material_code": scrap.material_code, "material_name": item.get("material_name") or scrap.material_code,
        "planned_quantity": float(planned), "used_quantity": float(used), "damaged_quantity": float(scrap.quantity),
        "quantity": float(scrap.quantity), "uom": scrap.uom, "reason": scrap.reason,
        "employee_team": scrap.employee_team, "approval_required": scrap.approval_required,
        "status": scrap.status, "date": scrap.recorded_at.isoformat(),
        "approved_by": scrap.approved_by, "approved_at": scrap.approved_at.isoformat() if scrap.approved_at else None,
    }


@router.get("/orders/{order_id}/scrap")
async def list_assembly_scrap(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    result = await uow.session.execute(select(AssemblyScrapModel).where(
        AssemblyScrapModel.assembly_order_id == order.id
    ).order_by(AssemblyScrapModel.recorded_at.desc()))
    records = [await scrap_response(uow, order, scrap) for scrap in result.scalars().all()]
    return {
        "order_number": order.order_number, "order_status": order.status,
        "summary": {"records": len(records), "damaged_quantity": sum(row["quantity"] for row in records),
                    "pending_approval": sum(row["status"] == "PENDING_APPROVAL" for row in records)},
        "records": records,
    }


@router.post("/orders/{order_id}/scrap", status_code=201)
async def create_assembly_scrap(order_id: uuid.UUID, request: AssemblyScrapCreate, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id, with_for_update=True)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    if order.status not in {"IN_PROGRESS", "ON_HOLD", "COMPLETED", "QUALITY_CHECK"}:
        raise HTTPException(status_code=409, detail="Start assembly before recording scrap")
    requirements = aggregate_requirements(order.items or [])
    material_code = request.material_code.strip()
    if material_code not in requirements:
        raise HTTPException(status_code=422, detail="Material is not required by this assembly order")
    existing_total = await uow.session.scalar(select(func.coalesce(func.sum(AssemblyScrapModel.quantity), 0)).where(
        AssemblyScrapModel.assembly_order_id == order.id, AssemblyScrapModel.material_code == material_code
    ))
    if Decimal(str(existing_total)) + request.quantity > requirements[material_code]["quantity"]:
        raise HTTPException(status_code=422, detail="Total damaged quantity cannot exceed material issued for the order")
    scrap = AssemblyScrapModel(
        id=uuid.uuid4(), assembly_order_id=order.id, material_code=material_code,
        quantity=request.quantity, uom=request.uom.strip().upper(), reason=request.reason.strip(),
        employee_team=request.employee_team.strip(), approval_required=request.approval_required,
        status="PENDING_APPROVAL" if request.approval_required else "RECORDED", recorded_at=datetime.now(),
    )
    uow.session.add(scrap)
    await uow.commit()
    return await scrap_response(uow, order, scrap)


@router.patch("/orders/{order_id}/scrap/{scrap_id}/approve")
async def approve_assembly_scrap(order_id: uuid.UUID, scrap_id: uuid.UUID, request: AssemblyScrapApproval, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    scrap = await uow.session.get(AssemblyScrapModel, scrap_id, with_for_update=True)
    if not scrap or scrap.assembly_order_id != order.id:
        raise HTTPException(status_code=404, detail="Scrap record not found")
    if scrap.status != "PENDING_APPROVAL":
        raise HTTPException(status_code=409, detail="Scrap record is not pending approval")
    scrap.status = "APPROVED"
    scrap.approved_by = request.approved_by.strip()
    scrap.approved_at = datetime.now()
    await uow.commit()
    return await scrap_response(uow, order, scrap)


@router.get("/orders/{order_id}/material-issue")
async def get_order_material_issue(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")
    issue = await uow.session.get(MaterialIssueModel, order.material_issue_id)
    task = await uow.session.get(PickTaskModel, order.pick_task_id)
    if not issue or not task:
        raise HTTPException(status_code=404, detail="Material issue handoff was not found")

    material_codes = list(aggregate_requirements(order.items or []))
    locations = {
        allocation.get("location")
        for item in issue.items or []
        for allocation in item.get("allocations") or []
        if allocation.get("location")
    }
    batches_by_material: dict[str, set[str]] = defaultdict(set)
    if material_codes and locations:
        units_result = await uow.session.execute(
            select(HandlingUnitModel).where(
                HandlingUnitModel.item_code.in_(material_codes),
                HandlingUnitModel.current_location.in_(locations),
            )
        )
        for unit in units_result.scalars().all():
            if unit.batch_number:
                batches_by_material[unit.item_code].add(unit.batch_number)
        movements_result = await uow.session.execute(
            select(PutawayMovementModel).where(
                PutawayMovementModel.material_code.in_(material_codes),
                PutawayMovementModel.destination_location.in_(locations),
            )
        )
        for movement in movements_result.scalars().all():
            if movement.batch_lot:
                batches_by_material[movement.material_code].add(movement.batch_lot)

    lines = build_material_issue_lines(order.items or [], issue.items or [], batches_by_material)
    overall_status = "ISSUED" if all(line["status"] == "ISSUED" for line in lines) else (
        "PARTIALLY_ISSUED" if any(line["issued_quantity"] > 0 for line in lines) else "PENDING"
    )
    return {
        "assembly_order_id": str(order.id), "order_number": order.order_number,
        "material_request_id": str(order.material_request_id), "request_number": order.request_number,
        "material_issue_id": str(issue.id), "issue_number": issue.issue_number,
        "warehouse": task.warehouse_id, "destination": task.destination,
        "issued_by": issue.issued_by, "received_by": issue.received_by,
        "issue_date": issue.issued_at.isoformat(), "status": overall_status, "materials": lines,
    }


@router.get("/orders/{order_id}/requirements")
async def get_order_requirements(order_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    order = await uow.session.get(AssemblyOrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Assembly order not found")

    reservation_result = await uow.session.execute(
        select(AssemblyMaterialReservationModel).where(
            AssemblyMaterialReservationModel.assembly_order_id == order.id,
            AssemblyMaterialReservationModel.status == "RESERVED",
        )
    )
    reservations = {row.material_code: row for row in reservation_result.scalars().all()}

    requirements = []
    for material_code, requirement in aggregate_requirements(order.items or []).items():
        item = requirement["item"]
        required_qty = requirement["quantity"]

        # Check stock availability
        stock = await uow.session.scalar(
            select(MaterialStockModel).where(MaterialStockModel.material_code == material_code)
        )

        on_hand_qty = stock.on_hand if stock else Decimal("0")
        free_qty = stock.available if stock else Decimal("0")
        reserved_qty = reservations[material_code].quantity if material_code in reservations else Decimal("0")
        status, status_label = material_requirement_status(required_qty, free_qty, reserved_qty)

        requirements.append({
            "component": item.get("material_name") or material_code,
            "material_code": material_code,
            "required": float(required_qty),
            "available": float(on_hand_qty),
            "reserved": float(reserved_qty),
            "free_stock": float(free_qty),
            "status": status,
            "status_label": status_label,
            "shortage_quantity": float(max(required_qty - free_qty - reserved_qty, Decimal("0"))),
            "uom": item.get("uom") or "PCS"
        })

    return {
        "order_number": order.order_number,
        "summary": {
            "total": len(requirements),
            "available": sum(row["status"] == "AVAILABLE" for row in requirements),
            "reserved": sum(row["status"] == "RESERVED" for row in requirements),
            "shortage": sum(row["status"] == "SHORTAGE" for row in requirements),
            "all_materials_ready": all(row["status"] != "SHORTAGE" for row in requirements),
        },
        "requirements": requirements
    }


@router.get("/reports")
async def assembly_reports(uow: UnitOfWork = Depends(get_uow)):
    await backfill_issued_orders(uow)
    orders = list((await uow.session.execute(select(AssemblyOrderModel))).scalars().all())
    order_by_id = {order.id: order for order in orders}
    today = date.today()
    complete_statuses = {"COMPLETED", "QUALITY_CHECK", "CLOSED"}
    delayed = [order for order in orders if order.required_date and order.required_date < today and order.status not in complete_statuses]

    consumption_records = list((await uow.session.execute(
        select(AssemblyMaterialConsumptionModel).order_by(AssemblyMaterialConsumptionModel.material_code)
    )).scalars().all())
    consumption_lines = []
    for record in consumption_records:
        variance = calculate_material_variance(record.expected_per_unit, record.assembled_quantity, record.actual_consumed)
        consumption_lines.append({
            "order_number": order_by_id.get(record.assembly_order_id).order_number if record.assembly_order_id in order_by_id else "—",
            "material_code": record.material_code, "planned": variance["expected_consumption"],
            "actual": variance["actual_consumption"], "variance": variance["variance_quantity"],
            "variance_percent": variance["variance_percent"], "uom": record.uom,
        })

    scrap_records = list((await uow.session.execute(select(AssemblyScrapModel))).scalars().all())
    consumption_by_key = {(row.assembly_order_id, row.material_code): row for row in consumption_records}
    wastage_lines = []
    for scrap in scrap_records:
        order = order_by_id.get(scrap.assembly_order_id)
        consumption = consumption_by_key.get((scrap.assembly_order_id, scrap.material_code))
        planned = consumption.expected_per_unit * consumption.assembled_quantity if consumption else (
            aggregate_requirements(order.items or []).get(scrap.material_code, {}).get("quantity", Decimal("0")) if order else Decimal("0")
        )
        wastage_lines.append({
            "order_number": order.order_number if order else "—", "material_code": scrap.material_code,
            "material_wastage": float(scrap.quantity), "scrap_quantity": float(scrap.quantity),
            "planned_quantity": float(planned),
            "wastage_percent": round(float(scrap.quantity / planned * 100), 2) if planned else 0,
            "uom": scrap.uom, "reason": scrap.reason,
        })

    inspections = list((await uow.session.execute(select(AssemblyQualityInspectionModel))).scalars().all())
    passed = sum((row.passed_quantity for row in inspections), Decimal("0"))
    failed = sum((row.failed_quantity for row in inspections), Decimal("0"))
    rework = sum((row.rework_quantity for row in inspections), Decimal("0"))
    inspected = passed + failed + rework

    teams = list((await uow.session.execute(select(AssemblyTeamModel).order_by(AssemblyTeamModel.name))).scalars().all())
    team_lines = []
    for team in teams:
        assigned = [order for order in orders if order.assigned_team == team.name]
        target = sum((order.planned_quantity for order in assigned), Decimal("0"))
        actual = sum((order.completed_quantity for order in assigned), Decimal("0"))
        team_lines.append({
            "team": team.name, "team_output": float(actual), "target": float(target), "actual": float(actual),
            "completed_orders": sum(order.status in complete_statuses for order in assigned),
            "total_orders": len(assigned), "workers": len(team.workers or []),
            "productivity": round(float(actual / target * 100), 2) if target else 0,
        })

    planned_total = sum((Decimal(str(line["planned"])) for line in consumption_lines), Decimal("0"))
    actual_total = sum((Decimal(str(line["actual"])) for line in consumption_lines), Decimal("0"))
    scrap_total = sum((scrap.quantity for scrap in scrap_records), Decimal("0"))
    scrap_planned = sum((Decimal(str(line["planned_quantity"])) for line in wastage_lines), Decimal("0"))
    return {
        "production": {"total_orders": len(orders), "completed_orders": sum(order.status in complete_statuses for order in orders),
                       "pending_orders": sum(order.status not in complete_statuses for order in orders), "delayed_orders": len(delayed),
                       "delayed": [{"order_number": row.order_number, "required_date": row.required_date.isoformat(), "status": row.status} for row in delayed]},
        "consumption": {"planned": float(planned_total), "actual": float(actual_total), "variance": float(actual_total - planned_total), "lines": consumption_lines},
        "wastage": {"material_wastage": float(scrap_total), "scrap_quantity": float(scrap_total),
                    "wastage_percentage": round(float(scrap_total / scrap_planned * 100), 2) if scrap_planned else 0, "lines": wastage_lines},
        "quality": {"passed": float(passed), "failed": float(failed), "rework": float(rework),
                    "rejection_rate": round(float(failed / inspected * 100), 2) if inspected else 0},
        "team_performance": team_lines,
        "generated_at": datetime.now().isoformat(),
    }


@router.get("/overview/{section}")
async def assembly_module_overview(section: str, uow: UnitOfWork = Depends(get_uow)):
    section = section.strip().lower().replace("_", "-")
    supported = {"material-requirements", "material-reservations", "material-issues", "work-orders",
                 "assembly-progress", "material-consumption", "scrap-wastage", "quality-inspection",
                 "rework", "finished-goods"}
    if section not in supported:
        raise HTTPException(status_code=404, detail="Assembly overview section not found")
    await backfill_issued_orders(uow)
    orders = list((await uow.session.execute(select(AssemblyOrderModel).order_by(
        AssemblyOrderModel.created_at.desc()
    ))).scalars().all())
    order_map = {order.id: order for order in orders}
    rows: list[dict] = []
    columns: list[dict] = []

    if section == "material-requirements":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "material", "label": "Material"},
                   {"key": "required", "label": "Required"}, {"key": "available", "label": "Available"},
                   {"key": "status", "label": "Status"}]
        reservations = list((await uow.session.execute(select(AssemblyMaterialReservationModel))).scalars().all())
        reservation_map = {(row.assembly_order_id, row.material_code): row.quantity for row in reservations if row.status == "RESERVED"}
        stocks = {row.material_code: row for row in (await uow.session.execute(select(MaterialStockModel))).scalars().all()}
        for order in orders:
            for code, requirement in aggregate_requirements(order.items or []).items():
                stock = stocks.get(code); required = requirement["quantity"]
                reserved = reservation_map.get((order.id, code), Decimal("0")); free = stock.available if stock else Decimal("0")
                status, _ = material_requirement_status(required, free, reserved)
                rows.append({"order": order.order_number, "material": requirement["item"].get("material_name") or code,
                             "required": f"{required:g} {requirement['item'].get('uom') or 'PCS'}",
                             "available": f"{(stock.on_hand if stock else Decimal('0')):g}", "status": status,
                             "order_id": str(order.id)})
    elif section == "material-reservations":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "material", "label": "Material"},
                   {"key": "quantity", "label": "Reserved quantity"}, {"key": "reserved_by", "label": "Reserved by"},
                   {"key": "reserved_at", "label": "Reserved at"}, {"key": "status", "label": "Status"}]
        records = (await uow.session.execute(select(AssemblyMaterialReservationModel).order_by(
            AssemblyMaterialReservationModel.reserved_at.desc()))).scalars().all()
        for record in records:
            order = order_map.get(record.assembly_order_id)
            rows.append({"order": order.order_number if order else "—", "material": record.material_code,
                         "quantity": f"{record.quantity:g} {record.uom}", "reserved_by": record.reserved_by,
                         "reserved_at": record.reserved_at.isoformat(), "status": record.status,
                         "order_id": str(record.assembly_order_id)})
    elif section == "material-issues":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "issue", "label": "Issue number"},
                   {"key": "warehouse", "label": "Warehouse"}, {"key": "materials", "label": "Materials"},
                   {"key": "issued_by", "label": "Issued by"}, {"key": "issued_at", "label": "Issue date"},
                   {"key": "status", "label": "Status"}]
        for order in orders:
            issue = await uow.session.get(MaterialIssueModel, order.material_issue_id)
            task = await uow.session.get(PickTaskModel, order.pick_task_id)
            if issue:
                rows.append({"order": order.order_number, "issue": issue.issue_number,
                             "warehouse": task.warehouse_id if task else "—", "materials": len(issue.items or []),
                             "issued_by": issue.issued_by, "issued_at": issue.issued_at.isoformat(), "status": "ISSUED",
                             "order_id": str(order.id)})
    elif section == "work-orders":
        columns = [{"key": "order", "label": "Work order"}, {"key": "product", "label": "Product"},
                   {"key": "target", "label": "Target"}, {"key": "team", "label": "Assembly team"},
                   {"key": "steps", "label": "Steps completed"}, {"key": "status", "label": "Status"}]
        for order in orders:
            steps = order.assembly_steps or default_assembly_steps()
            rows.append({"order": order.order_number, "product": order.product_name, "target": float(order.planned_quantity),
                         "team": order.assigned_team or "Not assigned", "steps": f"{sum(s.get('status') == 'COMPLETED' for s in steps)} / {len(steps)}",
                         "status": order.status, "order_id": str(order.id)})
    elif section == "assembly-progress":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "team", "label": "Team"},
                   {"key": "target", "label": "Target"}, {"key": "completed", "label": "Completed"},
                   {"key": "remaining", "label": "Remaining"}, {"key": "progress", "label": "Progress"},
                   {"key": "status", "label": "Status"}]
        for order in orders:
            progress = calculate_assembly_progress(order.planned_quantity, order.completed_quantity, order.status)
            rows.append({"order": order.order_number, "team": order.assigned_team or "Not assigned", "target": progress["target"],
                         "completed": progress["completed"], "remaining": progress["remaining"],
                         "progress": f"{progress['progress_percent']}%", "status": progress["progress_status"], "order_id": str(order.id)})
    elif section == "material-consumption":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "material", "label": "Material"},
                   {"key": "planned", "label": "Planned"}, {"key": "actual", "label": "Actual"},
                   {"key": "variance", "label": "Variance"}, {"key": "status", "label": "Status"}]
        records = (await uow.session.execute(select(AssemblyMaterialConsumptionModel).order_by(
            AssemblyMaterialConsumptionModel.updated_at.desc()))).scalars().all()
        for record in records:
            variance = calculate_material_variance(record.expected_per_unit, record.assembled_quantity, record.actual_consumed)
            order = order_map.get(record.assembly_order_id)
            rows.append({"order": order.order_number if order else "—", "material": record.material_code,
                         "planned": variance["expected_consumption"], "actual": variance["actual_consumption"],
                         "variance": variance["variance_quantity"], "status": variance["status"], "order_id": str(record.assembly_order_id)})
    elif section == "scrap-wastage":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "material", "label": "Material"},
                   {"key": "quantity", "label": "Scrap quantity"}, {"key": "reason", "label": "Reason"},
                   {"key": "employee", "label": "Employee / team"}, {"key": "date", "label": "Date"},
                   {"key": "status", "label": "Approval"}]
        records = (await uow.session.execute(select(AssemblyScrapModel).order_by(AssemblyScrapModel.recorded_at.desc()))).scalars().all()
        for record in records:
            order = order_map.get(record.assembly_order_id)
            rows.append({"order": order.order_number if order else "—", "material": record.material_code,
                         "quantity": f"{record.quantity:g} {record.uom}", "reason": record.reason,
                         "employee": record.employee_team, "date": record.recorded_at.isoformat(),
                         "status": record.status, "order_id": str(record.assembly_order_id)})
    elif section == "quality-inspection":
        columns = [{"key": "order", "label": "Assembly order"}, {"key": "produced", "label": "Produced"},
                   {"key": "passed", "label": "Passed"}, {"key": "failed", "label": "Failed"},
                   {"key": "rework", "label": "Rework"}, {"key": "inspector", "label": "Inspected by"},
                   {"key": "status", "label": "Result"}]
        records = (await uow.session.execute(select(AssemblyQualityInspectionModel).order_by(
            AssemblyQualityInspectionModel.updated_at.desc()))).scalars().all()
        for record in records:
            order = order_map.get(record.assembly_order_id)
            rows.append({"order": order.order_number if order else "—", "produced": float(record.produced_quantity),
                         "passed": float(record.passed_quantity), "failed": float(record.failed_quantity),
                         "rework": float(record.rework_quantity), "inspector": record.inspected_by or "Pending",
                         "status": record.status, "order_id": str(record.assembly_order_id)})
    elif section == "rework":
        columns = [{"key": "rework", "label": "Rework order"}, {"key": "assembly", "label": "Assembly order"},
                   {"key": "reason", "label": "Failure reason"}, {"key": "quantity", "label": "Failed quantity"},
                   {"key": "assignment", "label": "Team / worker"}, {"key": "status", "label": "Status"},
                   {"key": "result", "label": "Final result"}]
        records = (await uow.session.execute(select(AssemblyReworkOrderModel).order_by(
            AssemblyReworkOrderModel.created_at.desc()))).scalars().all()
        for record in records:
            order = order_map.get(record.assembly_order_id)
            rows.append({"rework": record.rework_number, "assembly": order.order_number if order else "—",
                         "reason": record.reason_for_failure, "quantity": float(record.failed_quantity),
                         "assignment": f"{record.assigned_team} / {record.assigned_worker or 'Team'}",
                         "status": record.status, "result": record.final_result, "order_id": str(record.assembly_order_id)})
    elif section == "finished-goods":
        columns = [{"key": "product", "label": "Finished product"}, {"key": "code", "label": "Product code"},
                   {"key": "quantity", "label": "Available quantity"}, {"key": "warehouse", "label": "Warehouse"},
                   {"key": "location", "label": "Location"}, {"key": "posted", "label": "Posted at"},
                   {"key": "status", "label": "Status"}]
        records = (await uow.session.execute(select(AssemblyFinishedGoodsModel).order_by(
            AssemblyFinishedGoodsModel.updated_at.desc()))).scalars().all()
        for record in records:
            rows.append({"product": record.product_name, "code": record.product_code,
                         "quantity": f"{record.quantity:g} {record.uom}", "warehouse": record.warehouse_id,
                         "location": record.location_code, "posted": record.posted_at.isoformat(),
                         "status": record.status, "order_id": str(record.assembly_order_id)})

    status_counts = defaultdict(int)
    for row in rows: status_counts[str(row.get("status") or row.get("result") or "RECORDED")] += 1
    return {"section": section, "total": len(rows), "columns": columns, "rows": rows,
            "status_summary": [{"status": key, "count": value} for key, value in status_counts.items()],
            "generated_at": datetime.now().isoformat()}


@router.get("/dashboard")
async def assembly_dashboard(uow: UnitOfWork = Depends(get_uow)):
    await backfill_issued_orders(uow)
    result = await uow.session.execute(select(AssemblyOrderModel).order_by(AssemblyOrderModel.created_at.asc()))
    orders = list(result.scalars().all())
    statuses = defaultdict(int)
    consumption = defaultdict(float)
    for order in orders:
        statuses[order.status] += 1
        for item in order.items or []:
            consumption[item.get("material_name") or item.get("material_code") or "Material"] += float(item.get("quantity") or 0)
    today = date.today()
    for order in orders:
        await add_assembly_notification(uow, "New assembly order created",
                                        f"{order.order_number} was created for {order.product_name}.", order)
        issue = await uow.session.get(MaterialIssueModel, order.material_issue_id)
        if issue:
            await add_assembly_notification(uow, "Material issued",
                                            f"Materials for {order.order_number} were issued under {issue.issue_number}.", order)
        if order.required_date and order.required_date < today and order.status not in {"COMPLETED", "QUALITY_CHECK", "CLOSED"}:
            await add_assembly_notification(uow, "Assembly delayed",
                                            f"{order.order_number} passed its required date of {order.required_date.isoformat()}.", order)
        if order.status == "MATERIAL_SHORTAGE":
            await add_assembly_notification(uow, "Material shortage",
                                            f"{order.order_number} cannot proceed because required material is short.", order)
        if order.status == "QUALITY_CHECK":
            await add_assembly_notification(uow, "Quality inspection pending",
                                            f"{order.order_number} is awaiting finished assembly inspection.", order)
        if order.completed_at:
            await add_assembly_notification(uow, "Assembly completed",
                                            f"Assembly work for {order.order_number} is complete.", order)
    inspections_result = await uow.session.execute(select(AssemblyQualityInspectionModel))
    for inspection in inspections_result.scalars().all():
        order = next((row for row in orders if row.id == inspection.assembly_order_id), None)
        if order and inspection.status == "FAILED":
            await add_assembly_notification(uow, "Quality failed",
                                            f"{order.order_number} failed quality inspection for {inspection.failed_quantity:g} units.", order)
        if order and inspection.status == "REWORK_REQUIRED":
            await add_assembly_notification(uow, "Rework required",
                                            f"{order.order_number} requires rework for {inspection.rework_quantity:g} units.", order)
    rework_result = await uow.session.execute(select(AssemblyReworkOrderModel))
    for rework in rework_result.scalars().all():
        order = next((row for row in orders if row.id == rework.assembly_order_id), None)
        if order:
            await add_assembly_notification(uow, "Rework required",
                                            f"{rework.rework_number} assigned to {rework.assigned_team} for {rework.failed_quantity:g} units.", order)
    finished_result = await uow.session.execute(select(AssemblyFinishedGoodsModel))
    for finished in finished_result.scalars().all():
        order = next((row for row in orders if row.id == finished.assembly_order_id), None)
        if order:
            await add_assembly_notification(uow, "Finished goods transferred to inventory",
                                            f"{finished.quantity:g} {finished.uom} of {finished.product_name} from {order.order_number} posted to {finished.warehouse_id} / {finished.location_code}.", order)
    await uow.commit()
    notification_result = await uow.session.execute(select(NotificationModel).where(
        NotificationModel.user_role == "ASSEMBLY_MANAGER"
    ).order_by(NotificationModel.created_at.desc()).limit(12))
    notifications = [{"id": str(row.id), "title": row.title, "message": row.message, "link": row.link,
                      "is_read": row.is_read, "created_at": row.created_at.isoformat()} for row in notification_result.scalars().all()]
    output = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        output.append({"date": day.strftime("%d %b"),
                       "completed": sum(float(o.completed_quantity) for o in orders if o.completed_at and o.completed_at.date() == day),
                       "rejected": sum(float(o.rejected_quantity) for o in orders if o.completed_at and o.completed_at.date() == day)})
    total_completed = sum(float(o.completed_quantity) for o in orders)
    total_rejected = sum(float(o.rejected_quantity) for o in orders)
    status_keys = ["DRAFT", "RELEASED", "MATERIAL_CHECK", "READY", "IN_PROGRESS", "COMPLETED", "QUALITY_CHECK", "CLOSED", "ON_HOLD", "MATERIAL_SHORTAGE"]
    return {
        "stats": {"total": len(orders), "pending": sum(statuses[key] for key in ["DRAFT", "RELEASED", "MATERIAL_CHECK", "READY"]), "in_progress": statuses["IN_PROGRESS"],
                  "completed": sum(statuses[key] for key in ["COMPLETED", "QUALITY_CHECK", "CLOSED"]), "on_hold": statuses["ON_HOLD"], "material_shortage": statuses["MATERIAL_SHORTAGE"],
                  "quality_pending": statuses["QUALITY_CHECK"], "today_output": sum(float(o.completed_quantity) for o in orders if o.completed_at and o.completed_at.date() == today)},
        "status_chart": [{"status": key.replace("_", " ").title(), "count": statuses[key]} for key in status_keys],
        "output_chart": output,
        "consumption_chart": [{"material": key, "quantity": value} for key, value in sorted(consumption.items(), key=lambda x: -x[1])[:6]],
        "quality": {"completed": total_completed, "rejected": total_rejected,
                    "defect_rate": round(total_rejected / (total_completed + total_rejected) * 100, 2) if total_completed + total_rejected else 0},
        "notifications": notifications,
        "orders": [serialize_order(order) for order in reversed(orders)],
    }
