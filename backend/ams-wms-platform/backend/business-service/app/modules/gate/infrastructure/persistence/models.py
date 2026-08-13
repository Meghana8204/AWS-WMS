"""
Gate Entry SQLAlchemy ORM Model.
"""
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, DateTime, Numeric, String, Text
from app.database import Base


class GateEntryModel(Base):
    __tablename__ = "gate_entries"

    id = Column(String(64), primary_key=True)
    gate_entry_number = Column(String(64), unique=True, nullable=False, index=True)
    warehouse_id = Column(String(64), nullable=False)
    vehicle_number = Column(String(64), nullable=False, index=True)
    supplier_name = Column(String(255), nullable=False)
    driver_name = Column(String(128), nullable=False)
    driver_phone = Column(String(32), nullable=False)
    asn_id = Column(String(64), nullable=True, index=True)
    asn_number = Column(String(64), nullable=True)
    po_id = Column(String(64), nullable=True)
    po_number = Column(String(64), nullable=True)
    supplier_id = Column(String(64), nullable=True)
    assigned_dock_id = Column(String(64), nullable=True)
    security_officer_id = Column(String(64), nullable=True)
    verification_notes = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="CHECKED_IN")
    entry_time = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    exit_time = Column(DateTime(timezone=True), nullable=True)
    gross_weight_kg = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    tare_weight_kg = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
