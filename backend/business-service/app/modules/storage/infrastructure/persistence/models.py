"""
SQLAlchemy ORM models for the Storage module (Putaway & Locations).
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, GUID


class StorageLocationModel(Base):
    __tablename__ = "storage_location"
    __table_args__ = (UniqueConstraint("warehouse_id", "zone", "rack", "bin", name="uq_storage_location_path"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    location_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    zone: Mapped[str] = mapped_column(String(128), nullable=False)
    rack: Mapped[str] = mapped_column(String(64), nullable=False)
    bin: Mapped[str] = mapped_column(String(64), nullable=False)
    capacity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    occupied_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PutawayTaskModel(Base):
    __tablename__ = "putaway_task"
    __table_args__ = (UniqueConstraint("grn_id", "item_code", name="uq_putaway_task_grn_item"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    task_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    grn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("grn.id", ondelete="RESTRICT"), nullable=False, index=True)
    grn_number: Mapped[str] = mapped_column(String(64), nullable=False)
    handling_unit_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("handling_unit.id", ondelete="RESTRICT"), nullable=True, unique=True, index=True)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(256), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(32), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    source_location: Mapped[str] = mapped_column(String(64), nullable=False, default="RECEIVING_AREA")
    destination_location_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("storage_location.id", ondelete="RESTRICT"), nullable=True, index=True)
    destination_zone: Mapped[str | None] = mapped_column(String(128), nullable=True)
    destination_rack: Mapped[str | None] = mapped_column(String(64), nullable=True)
    destination_bin: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location_assigned_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    location_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    assigned_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    material_category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    handling_requirement: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rotation_policy: Mapped[str | None] = mapped_column(String(16), nullable=True)
    placement_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="OPEN", index=True)
    started_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class HandlingUnitModel(Base):
    __tablename__ = "handling_unit"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    hu_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    barcode_value: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    receiving_line_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("receiving_line.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True)
    grn_line_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("grn_line.id", ondelete="RESTRICT"), nullable=True, unique=True, index=True)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    material_name: Mapped[str] = mapped_column(String(256), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(32), nullable=False)
    batch_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)
    asn_number: Mapped[str] = mapped_column(String(64), nullable=False)
    grn_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    current_location: Mapped[str] = mapped_column(String(128), nullable=False, default="RECEIVING_AREA")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="LABEL_GENERATED", index=True)
    generated_by: Mapped[str] = mapped_column(String(128), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PutawayMovementModel(Base):
    __tablename__ = "putaway_movement"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    putaway_task_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("putaway_task.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True)
    material_scan: Mapped[str] = mapped_column(String(64), nullable=False)
    location_scan: Mapped[str] = mapped_column(String(64), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(256), nullable=False)
    source_location: Mapped[str] = mapped_column(String(128), nullable=False)
    destination_location: Mapped[str] = mapped_column(String(128), nullable=False)
    batch_lot: Mapped[str | None] = mapped_column(String(128), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    container_pallet: Mapped[str | None] = mapped_column(String(128), nullable=True)
    confirmed_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(32), nullable=False)
    inventory_available_before: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    inventory_available_after: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    confirmed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class InventoryLocationBalanceModel(Base):
    __tablename__ = "inventory_location_balance"
    __table_args__ = (UniqueConstraint("material_code", "storage_location_id", name="uq_inventory_location_material_bin"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    material_name: Mapped[str] = mapped_column(String(256), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    storage_location_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("storage_location.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    available_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    uom: Mapped[str] = mapped_column(String(32), nullable=False)
    last_putaway_task_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("putaway_task.id", ondelete="RESTRICT"), nullable=False)
    last_grn_number: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

