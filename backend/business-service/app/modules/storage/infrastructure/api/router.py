"""
Storage API Router (Putaway tasks & Storage locations).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.database.session import UnitOfWork, get_uow
from app.modules.storage.infrastructure.persistence.models import PutawayTaskModel, StorageLocationModel

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/locations")
async def list_storage_locations(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(StorageLocationModel).where(StorageLocationModel.active.is_(True)))
    locations = result.scalars().all()
    return [
        {
            "id": str(loc.id),
            "warehouse_id": loc.warehouse_id,
            "zone": loc.zone,
            "rack": loc.rack,
            "bin": loc.bin,
            "capacity": float(loc.capacity),
            "occupied_quantity": float(loc.occupied_quantity),
            "available_capacity": float(loc.capacity - loc.occupied_quantity),
        }
        for loc in locations
    ]


@router.get("/putaway-tasks")
async def list_putaway_tasks(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(PutawayTaskModel).order_by(PutawayTaskModel.created_at.desc()))
    tasks = result.scalars().all()
    return [
        {
            "id": str(task.id),
            "task_number": task.task_number,
            "grn_id": str(task.grn_id) if task.grn_id else None,
            "grn_number": task.grn_number,
            "item_code": task.item_code,
            "material_name": task.material_name,
            "quantity": float(task.quantity),
            "uom": task.uom,
            "source_location": task.source_location,
            "destination_zone": task.destination_zone,
            "destination_rack": task.destination_rack,
            "destination_bin": task.destination_bin,
            "status": task.status,
            "created_by": task.created_by,
            "created_at": task.created_at.isoformat() if task.created_at else None,
        }
        for task in tasks
    ]
