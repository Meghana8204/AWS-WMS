"""
SQLAlchemy ORM models for the receiving module - counterparts of
GrnEntity/GrnLineEntity/PurchaseOrderEntity/PurchaseOrderLineEntity.
PurchaseOrder* remain read-side reference data (in a real deployment,
populated/synced by the Procurement module - see
app/modules/procurement/MIGRATION_NOTES.md).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PurchaseOrderModel(Base):
    __tablename__ = "purchase_order"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)

    lines: Mapped[list["PurchaseOrderLineModel"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderLineModel(Base):
    __tablename__ = "purchase_order_line"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_order.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    purchase_order: Mapped["PurchaseOrderModel"] = relationship(back_populates="lines")


class GrnModel(Base):
    __tablename__ = "grn"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    lines: Mapped[list["GrnLineModel"]] = relationship(
        back_populates="grn", cascade="all, delete-orphan"
    )


class GrnLineModel(Base):
    __tablename__ = "grn_line"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("grn.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    ordered_quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    grn: Mapped["GrnModel"] = relationship(back_populates="lines")
