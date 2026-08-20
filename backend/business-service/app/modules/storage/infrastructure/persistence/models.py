"""
SQLAlchemy ORM models for the Storage module (Putaway & Locations).
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, GUID


class StorageLocationModel(Base):
    __tablename__ = "storage_location"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    zone: Mapped[str] = mapped_column(String(32), nullable=False)
    rack: Mapped[str] = mapped_column(String(32), nullable=False)
    bin: Mapped[str] = mapped_column(String(32), nullable=False)
    capacity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal(1000))
    occupied_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal(0))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class PutawayTaskModel(Base):
    __tablename__ = "putaway_task"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    task_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    grn_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    grn_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str | None] = mapped_column(String(32), nullable=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_location: Mapped[str | None] = mapped_column(String(64), nullable=True)
    destination_location_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    destination_zone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    destination_rack: Mapped[str | None] = mapped_column(String(32), nullable=True)
    destination_bin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    location_assigned_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    location_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PUTAWAY_PENDING")
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
