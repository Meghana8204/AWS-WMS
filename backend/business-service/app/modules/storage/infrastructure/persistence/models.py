"""
SQLAlchemy ORM models for Storage module (StorageLocationModel and PutawayTaskModel).
"""
from __future__ import annotations

from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, GUID


class StorageLocationModel(Base):
    __tablename__ = "storage_location"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    zone: Mapped[str] = mapped_column(String(32), nullable=False)
    rack: Mapped[str] = mapped_column(String(32), nullable=False)
    bin: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    capacity: Mapped[float] = mapped_column(Numeric(12, 4), default=1000.0, nullable=False)
    occupied_quantity: Mapped[float] = mapped_column(Numeric(12, 4), default=0.0, nullable=False)


class PutawayTaskModel(Base):
    __tablename__ = "putaway_task"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    grn_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    po_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(32), default="PCS", nullable=False)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_location: Mapped[str | None] = mapped_column(String(64), nullable=True)
    destination_location_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    destination_zone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    destination_rack: Mapped[str | None] = mapped_column(String(32), nullable=True)
    destination_bin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    location_assigned_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PUTAWAY_PENDING", nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
