"""
SQLAlchemy ORM models for the receiving module - counterparts of
GrnEntity/GrnLineEntity/PurchaseOrderEntity/PurchaseOrderLineEntity.
PurchaseOrderModel and PurchaseOrderItemModel (aliased as PurchaseOrderLineModel)
are supplied by the Procurement module.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.modules.procurement.infrastructure.persistence.models import (
    PurchaseOrderItemModel as PurchaseOrderLineModel,
    PurchaseOrderModel,
)


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


__all__ = ["PurchaseOrderModel", "PurchaseOrderLineModel", "GrnModel", "GrnLineModel"]
