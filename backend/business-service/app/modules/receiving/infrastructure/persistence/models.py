"""
SQLAlchemy ORM models for the receiving module.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, GUID


class GrnModel(Base):
    __tablename__ = "grn"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    po_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, nullable=True)
    po_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    lines: Mapped[list["GrnLineModel"]] = relationship(
        back_populates="grn", cascade="all, delete-orphan"
    )


class GrnLineModel(Base):
    __tablename__ = "grn_line"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("grn.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    ordered_quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    grn: Mapped["GrnModel"] = relationship(back_populates="lines")


class InventoryReceiptPostingModel(Base):
    __tablename__ = "inventory_receipt_posting"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("grn.id"), nullable=False, index=True)
    grn_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    po_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    po_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    asn_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    asn_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    material_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    uom: Mapped[str | None] = mapped_column(String(32), nullable=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    posted_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    on_hand_before: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    on_hand_after: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    posted_by: Mapped[str] = mapped_column(String(128), nullable=False)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


