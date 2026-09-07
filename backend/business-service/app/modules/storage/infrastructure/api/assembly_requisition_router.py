import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.common.api_model import ApiModel
from app.database.session import UnitOfWork, get_uow
from app.modules.procurement.infrastructure.persistence.models import (
    MaterialModel,
    MaterialVariantModel,
    NotificationModel,
)
from app.modules.storage.infrastructure.persistence.models import (
    AssemblyRequisitionItemModel,
    AssemblyRequisitionModel,
    PickupTaskModel,
)
from app.modules.store.infrastructure.persistence.models import StoreModel
from app.security.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/api/v1/assembly-requisitions", tags=["assembly-requisitions"])


class AssemblyRequisitionItemSchema(ApiModel):
    id: Optional[str] = None
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    material_code: str
    variant_code: Optional[str] = None
    material_name: str
    requested_quantity: Decimal
    issued_quantity: Decimal = Decimal("0.0")
    uom: str = "PCS"


class CreateAssemblyRequisitionItem(BaseModel):
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    material_code: str
    variant_code: Optional[str] = None
    material_name: str
    quantity: Decimal
    uom: str = "PCS"


class CreateAssemblyRequisitionRequest(BaseModel):
    warehouse_id: str = "Main Warehouse"
    department: str = "Assembly"
    requested_by: str
    priority: str = "MEDIUM"
    required_date: date
    remarks: Optional[str] = None
    items: List[CreateAssemblyRequisitionItem]


class AssignStoreToRequisitionRequest(BaseModel):
    store_id: str


class AssemblyRequisitionResponse(ApiModel):
    id: str
    requisition_number: str
    warehouse_id: str
    department: str
    requested_by: str
    priority: str
    required_date: date
    status: str
    assigned_store_id: Optional[str] = None
    assigned_store_code: Optional[str] = None
    assigned_store_name: Optional[str] = None
    assigned_by: Optional[str] = None
    assigned_at: Optional[datetime] = None
    remarks: Optional[str] = None
    items: List[AssemblyRequisitionItemSchema] = []
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=List[AssemblyRequisitionResponse])
async def list_assembly_requisitions(
    department: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
):
    stmt = select(AssemblyRequisitionModel).options(selectinload(AssemblyRequisitionModel.items))
    roles = [r.upper() for r in (user.roles or [])]

    if "ASSEMBLY" in roles and not any(r in ["ADMIN", "SUPERUSER", "WAREHOUSE", "WAREHOUSE_MANAGER"] for r in roles):
        stmt = stmt.where(func.lower(AssemblyRequisitionModel.department) == "assembly")
    elif department:
        stmt = stmt.where(func.lower(AssemblyRequisitionModel.department) == department.strip().lower())

    if status_filter and status_filter.upper() != "ALL":
        stmt = stmt.where(func.upper(AssemblyRequisitionModel.status) == status_filter.strip().upper())

    stmt = stmt.order_by(AssemblyRequisitionModel.created_at.desc())
    res = await uow.session.execute(stmt)
    records = res.scalars().all()

    return [
        AssemblyRequisitionResponse(
            id=str(r.id),
            requisition_number=r.requisition_number,
            warehouse_id=r.warehouse_id,
            department=r.department,
            requested_by=r.requested_by,
            priority=r.priority,
            required_date=r.required_date,
            status=r.status,
            assigned_store_id=str(r.assigned_store_id) if r.assigned_store_id else None,
            assigned_store_code=r.assigned_store_code,
            assigned_store_name=r.assigned_store_name,
            assigned_by=r.assigned_by,
            assigned_at=r.assigned_at,
            remarks=r.remarks,
            items=[
                AssemblyRequisitionItemSchema(
                    id=str(it.id),
                    material_id=str(it.material_id) if it.material_id else None,
                    material_variant_id=str(it.material_variant_id) if it.material_variant_id else None,
                    material_code=it.material_code,
                    variant_code=it.variant_code,
                    material_name=it.material_name,
                    requested_quantity=it.requested_quantity,
                    issued_quantity=it.issued_quantity,
                    uom=it.uom,
                )
                for it in r.items
            ],
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]


@router.post("", response_model=AssemblyRequisitionResponse, status_code=status.HTTP_201_CREATED)
async def create_assembly_requisition(
    payload: CreateAssemblyRequisitionRequest,
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requisition must contain at least one item",
        )

    now_utc = datetime.now(timezone.utc)
    current_year = now_utc.year

    # Generate sequential requisition number AR-YYYY-XXXX
    count_stmt = select(func.count(AssemblyRequisitionModel.id)).where(
        AssemblyRequisitionModel.requisition_number.like(f"AR-{current_year}-%")
    )
    count_res = await uow.session.execute(count_stmt)
    seq = (count_res.scalar() or 0) + 1
    req_number = f"AR-{current_year}-{seq:04d}"

    req = AssemblyRequisitionModel(
        id=uuid.uuid4(),
        requisition_number=req_number,
        warehouse_id=payload.warehouse_id,
        department=payload.department or "Assembly",
        requested_by=payload.requested_by or user.username or "Assembly Operator",
        priority=payload.priority.upper() if payload.priority else "MEDIUM",
        required_date=payload.required_date,
        status="PENDING",
        remarks=payload.remarks,
        created_at=now_utc,
        updated_at=now_utc,
    )
    uow.session.add(req)

    for it in payload.items:
        mat_uuid = None
        if it.material_id:
            try:
                mat_uuid = uuid.UUID(it.material_id)
            except ValueError:
                mat_uuid = None

        var_uuid = None
        if it.material_variant_id:
            try:
                var_uuid = uuid.UUID(it.material_variant_id)
            except ValueError:
                var_uuid = None

        item_model = AssemblyRequisitionItemModel(
            id=uuid.uuid4(),
            requisition_id=req.id,
            material_id=mat_uuid,
            material_variant_id=var_uuid,
            material_code=it.material_code.strip(),
            variant_code=it.variant_code.strip() if it.variant_code else None,
            material_name=it.material_name.strip(),
            requested_quantity=Decimal(str(it.quantity)),
            issued_quantity=Decimal("0.0"),
            uom=it.uom.strip().upper() if it.uom else "PCS",
        )
        uow.session.add(item_model)

    # Notify Warehouse of new Assembly Material Requisition
    notif = NotificationModel(
        id=uuid.uuid4(),
        user_role="WAREHOUSE",
        title=f"New Assembly Requisition: {req.requisition_number}",
        message=f"Assembly submitted requisition {req.requisition_number} ({len(payload.items)} items). Requires store assignment.",
        link="/warehouse/assembly-requisitions",
        is_read=False,
    )
    uow.session.add(notif)

    await uow.commit()

    # Refresh
    stmt = select(AssemblyRequisitionModel).options(selectinload(AssemblyRequisitionModel.items)).where(
        AssemblyRequisitionModel.id == req.id
    )
    res = await uow.session.execute(stmt)
    created_req = res.scalar_one()

    return AssemblyRequisitionResponse(
        id=str(created_req.id),
        requisition_number=created_req.requisition_number,
        warehouse_id=created_req.warehouse_id,
        department=created_req.department,
        requested_by=created_req.requested_by,
        priority=created_req.priority,
        required_date=created_req.required_date,
        status=created_req.status,
        remarks=created_req.remarks,
        items=[
            AssemblyRequisitionItemSchema(
                id=str(i.id),
                material_id=str(i.material_id) if i.material_id else None,
                material_variant_id=str(i.material_variant_id) if i.material_variant_id else None,
                material_code=i.material_code,
                variant_code=i.variant_code,
                material_name=i.material_name,
                requested_quantity=i.requested_quantity,
                issued_quantity=i.issued_quantity,
                uom=i.uom,
            )
            for i in created_req.items
        ],
        created_at=created_req.created_at,
        updated_at=created_req.updated_at,
    )


@router.get("/{id}", response_model=AssemblyRequisitionResponse)
async def get_assembly_requisition(
    id: str,
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
):
    try:
        req_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Requisition UUID")

    stmt = select(AssemblyRequisitionModel).options(selectinload(AssemblyRequisitionModel.items)).where(
        AssemblyRequisitionModel.id == req_uuid
    )
    res = await uow.session.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assembly Requisition not found")

    return AssemblyRequisitionResponse(
        id=str(req.id),
        requisition_number=req.requisition_number,
        warehouse_id=req.warehouse_id,
        department=req.department,
        requested_by=req.requested_by,
        priority=req.priority,
        required_date=req.required_date,
        status=req.status,
        assigned_store_id=str(req.assigned_store_id) if req.assigned_store_id else None,
        assigned_store_code=req.assigned_store_code,
        assigned_store_name=req.assigned_store_name,
        assigned_by=req.assigned_by,
        assigned_at=req.assigned_at,
        remarks=req.remarks,
        items=[
            AssemblyRequisitionItemSchema(
                id=str(it.id),
                material_id=str(it.material_id) if it.material_id else None,
                material_variant_id=str(it.material_variant_id) if it.material_variant_id else None,
                material_code=it.material_code,
                variant_code=it.variant_code,
                material_name=it.material_name,
                requested_quantity=it.requested_quantity,
                issued_quantity=it.issued_quantity,
                uom=it.uom,
            )
            for it in req.items
        ],
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.post("/{id}/assign-store")
async def assign_store_to_assembly_requisition(
    id: str,
    payload: AssignStoreToRequisitionRequest,
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
):
    roles = [r.upper() for r in (user.roles or [])]
    if not any(r in ["WAREHOUSE", "WAREHOUSE_MANAGER", "ADMIN", "SUPERUSER"] for r in roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized Warehouse personnel can assign stores to Assembly Requisitions.",
        )

    try:
        req_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Requisition UUID")

    try:
        store_uuid = uuid.UUID(payload.store_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Store UUID")

    stmt = select(AssemblyRequisitionModel).options(selectinload(AssemblyRequisitionModel.items)).where(
        AssemblyRequisitionModel.id == req_uuid
    )
    res = await uow.session.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assembly Requisition not found")

    store_stmt = select(StoreModel).where(StoreModel.id == store_uuid)
    store_res = await uow.session.execute(store_stmt)
    store = store_res.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned Store not found")
    if store.status.upper() != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Store '{store.store_name}' is inactive.")

    now_utc = datetime.now(timezone.utc)

    req.assigned_store_id = store.id
    req.assigned_store_code = store.store_code
    req.assigned_store_name = store.store_name
    req.assigned_by = user.username or "warehouse"
    req.assigned_at = now_utc
    req.status = "ASSIGNED_TO_STORE"
    req.updated_at = now_utc

    tasks_created = []
    for item in req.items:
        existing_pck_res = await uow.session.execute(
            select(PickupTaskModel).where(
                PickupTaskModel.requisition_id == req.id,
                PickupTaskModel.material_code == item.material_code,
            )
        )
        pck = existing_pck_res.scalar_one_or_none()
        if not pck:
            task_no = f"PCK-{now_utc.year}-{uuid.uuid4().hex[:6].upper()}"
            pck = PickupTaskModel(
                id=uuid.uuid4(),
                task_number=task_no,
                requisition_id=req.id,
                requisition_number=req.requisition_number,
                store_id=store.id,
                store_code=store.store_code,
                store_name=store.store_name,
                department=req.department or "Assembly",
                material_code=item.material_code,
                material_name=item.material_name,
                requested_quantity=item.requested_quantity,
                picked_quantity=Decimal("0.0"),
                uom=item.uom or "PCS",
                priority=req.priority or "MEDIUM",
                required_date=req.required_date,
                status="ASSIGNED_TO_STORE",
                assigned_by=user.username or "warehouse",
                assigned_at=now_utc,
                created_at=now_utc,
                updated_at=now_utc,
            )
            uow.session.add(pck)
        else:
            pck.store_id = store.id
            pck.store_code = store.store_code
            pck.store_name = store.store_name
            pck.status = "ASSIGNED_TO_STORE"
            pck.updated_at = now_utc
        tasks_created.append(pck)

    # Targeted store notification to STR:<store_code>
    notif = NotificationModel(
        id=uuid.uuid4(),
        user_role=f"STR:{store.store_code}",
        title=f"New Pickup Task Assigned — {store.store_name}",
        message=f"Assembly Requisition {req.requisition_number} ({len(req.items)} items) assigned to {store.store_name}.",
        link="/my-store",
        is_read=False,
    )
    uow.session.add(notif)

    # Targeted notification to STORE_KEEPER
    notif_sk = NotificationModel(
        id=uuid.uuid4(),
        user_role="STORE_KEEPER",
        title=f"New Pickup Task — {store.store_code}",
        message=f"Assembly Requisition {req.requisition_number} assigned to {store.store_name}.",
        link="/my-store",
        is_read=False,
    )
    uow.session.add(notif_sk)

    await uow.commit()

    return {
        "status": "success",
        "requisition_number": req.requisition_number,
        "assigned_store": {
            "id": str(store.id),
            "store_code": store.store_code,
            "store_name": store.store_name,
        },
        "tasks": [{"id": str(t.id), "task_number": t.task_number} for t in tasks_created],
    }
