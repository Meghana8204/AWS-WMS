"""
SQLAlchemy 2.0 ORM Database Models for AMS/WMS Platform.
Includes PurchaseOrder, GateEntry, and OutboxEvent models.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Date, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PurchaseOrder(Base):
    """
    Canonical Purchase Order entity stored in PostgreSQL.
    """
    __tablename__ = "purchase_orders"

    __table_args__ = (
        Index("ix_purchase_orders_po_number", "po_number", unique=True),
        Index("ix_purchase_orders_supplier_name", "supplier_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    material_description: Mapped[str] = mapped_column(Text, nullable=False)
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    po_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    delivery_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="OPEN", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GateEntry(Base):
    """
    Gate Entry Pass record for security gate control.
    """
    __tablename__ = "gate_entries"

    __table_args__ = (
        Index("ix_gate_entries_number", "gate_entry_number", unique=True),
        Index("ix_gate_entries_vehicle_plate", "vehicle_plate"),
        Index("ix_gate_entries_po_number", "po_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gate_entry_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    vehicle_plate: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    po_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    driver_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    ocr_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    mismatched_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), nullable=False, default="SECURITY_OFFICER")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OutboxEvent(Base):
    """
    Transactional Outbox Table for atomic event publishing (Kafka / Notifications).
    """
    __tablename__ = "outbox_events"

    __table_args__ = (
        Index("ix_outbox_events_status", "status"),
        Index("ix_outbox_events_aggregate", "aggregate_type", "aggregate_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aggregate_type: Mapped[str] = mapped_column(String(50), nullable=False)
    aggregate_id: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
