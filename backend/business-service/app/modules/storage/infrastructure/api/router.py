"""
FastAPI REST router for Storage & Putaway module.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.database.session import UnitOfWork, get_uow
from app.modules.storage.infrastructure.persistence.models import PutawayTaskModel, StorageLocationModel

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/locations")
async def list_storage_locations(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(StorageLocationModel))
    locations = result.scalars().all()
    return [{"id": str(loc.id), "warehouse_id": loc.warehouse_id, "zone": loc.zone, "rack": loc.rack, "bin": loc.bin, "active": loc.active, "capacity": float(loc.capacity), "occupied_quantity": float(loc.occupied_quantity)} for loc in locations]


@router.get("/putaway-tasks")
async def list_putaway_tasks(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(PutawayTaskModel).order_by(PutawayTaskModel.created_at.desc()))
    tasks = result.scalars().all()
    return [{
        "id": str(t.id), "grn_id": str(t.grn_id) if t.grn_id else None,
        "grn_number": t.grn_number, "po_number": t.po_number,
        "item_code": t.item_code, "material_name": t.material_name,
        "quantity": float(t.quantity), "uom": t.uom, "status": t.status,
        "source_location": t.source_location, "destination_zone": t.destination_zone,
        "destination_rack": t.destination_rack, "destination_bin": t.destination_bin,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in tasks]
