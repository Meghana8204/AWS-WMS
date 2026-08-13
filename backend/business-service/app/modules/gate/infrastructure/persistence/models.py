"""
SQLAlchemy ORM models for Gate Entry module.
Uses GUID and JSONType to support PostgreSQL in production and SQLite in testing.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, GUID

JSONType = JSON().with_variant(JSONB, "postgresql")


class GateEntryModel(Base):
    __tablename__ = "gate_entry"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    vehicle_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    driver_name: Mapped[str] = mapped_column(String(128), nullable=False)
    driver_license_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    driver_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    driver_photo_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    po_document_path: Mapped[str] = mapped_column(String(256), nullable=False)
    vehicle_photo_path: Mapped[str | None] = mapped_column(String(256), nullable=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    verification_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mismatched_fields: Mapped[dict | list | None] = mapped_column(JSONType, nullable=True)
    reasons: Mapped[dict | list | None] = mapped_column(JSONType, nullable=True)

    # ANPR results
    anpr_detected_vehicle: Mapped[str | None] = mapped_column(String(32), nullable=True)
    anpr_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    anpr_metadata: Mapped[dict | None] = mapped_column(JSONType, nullable=True)

    # OCR results
    ocr_po_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ocr_supplier_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ocr_product_material: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ocr_quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    ocr_po_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ocr_expected_delivery_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ocr_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # User & audit fields
    security_officer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    verified_by_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    manual_verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    audit_logs: Mapped[list["GateEntryAuditLogModel"]] = relationship(
        "GateEntryAuditLogModel", back_populates="gate_entry", cascade="all, delete-orphan"
    )


class GateEntryAuditLogModel(Base):
    __tablename__ = "gate_entry_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    gate_entry_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("gate_entry.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    performed_by: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    details: Mapped[dict | None] = mapped_column(JSONType, nullable=True)

    gate_entry: Mapped["GateEntryModel"] = relationship("GateEntryModel", back_populates="audit_logs")
