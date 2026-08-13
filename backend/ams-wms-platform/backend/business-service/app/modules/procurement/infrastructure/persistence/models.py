"""
SQLAlchemy ORM models for the procurement module.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class MaterialRequestModel(Base):
    __tablename__ = "material_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    department: Mapped[str] = mapped_column(String(64), nullable=False)
    requested_by: Mapped[str] = mapped_column(String(128), nullable=False)
    target_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="MEDIUM")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["MaterialRequestItemModel"]] = relationship(
        back_populates="material_request", cascade="all, delete-orphan", lazy="selectin"
    )


class MaterialRequestItemModel(Base):
    __tablename__ = "material_request_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    material_request_id: Mapped[str] = mapped_column(ForeignKey("material_requests.id"), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="Raw Material")
    unit_of_measure: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")
    requested_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    estimated_unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.00"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    material_request: Mapped["MaterialRequestModel"] = relationship(back_populates="items")


class RFQModel(Base):
    __tablename__ = "rfqs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    rfq_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    material_request_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON or CSV
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["RFQItemModel"]] = relationship(
        back_populates="rfq", cascade="all, delete-orphan", lazy="selectin"
    )
    invited_suppliers: Mapped[list["RFQSupplierModel"]] = relationship(
        back_populates="rfq", cascade="all, delete-orphan", lazy="selectin"
    )


class RFQItemModel(Base):
    __tablename__ = "rfq_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    rfq_id: Mapped[str] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")

    rfq: Mapped["RFQModel"] = relationship(back_populates="items")


class RFQSupplierModel(Base):
    __tablename__ = "rfq_suppliers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    rfq_id: Mapped[str] = mapped_column(ForeignKey("rfqs.id"), nullable=False)
    supplier_id: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_code: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="INVITED")

    rfq: Mapped["RFQModel"] = relationship(back_populates="invited_suppliers")


class SupplierQuotationModel(Base):
    __tablename__ = "supplier_quotations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    quotation_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    rfq_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    supplier_id: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_code: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    submission_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    payment_terms: Mapped[str] = mapped_column(String(64), nullable=False, default="NET30")
    delivery_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="SUBMITTED")
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["QuotationItemModel"]] = relationship(
        back_populates="quotation", cascade="all, delete-orphan", lazy="selectin"
    )


class QuotationItemModel(Base):
    __tablename__ = "quotation_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("supplier_quotations.id"), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    offered_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=Decimal("0.18"))
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))

    quotation: Mapped["SupplierQuotationModel"] = relationship(back_populates="items")


class FinanceApprovalModel(Base):
    __tablename__ = "finance_approvals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    po_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    requested_by: Mapped[str] = mapped_column(String(128), nullable=False)
    budget_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    approver_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approver_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    approval_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class PurchaseOrderModel(Base):
    __tablename__ = "purchase_order"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    po_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")

    # Section 1: PO INFORMATION
    supplier_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    department: Mapped[str | None] = mapped_column(String(64), nullable=True)
    buyer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(String(64), nullable=True, default="NET30")
    rfq_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    quotation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    finance_approval_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Section 2: SUPPLIER INFORMATION
    supplier_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    supplier_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Section 4: DELIVERY DETAILS
    delivery_warehouse: Mapped[str | None] = mapped_column(String(64), nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    transporter: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Section 6: METRICS
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=Decimal("0.18"))
    additional_charges: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["PurchaseOrderItemModel"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan", lazy="selectin"
    )
    lines: Mapped[list["PurchaseOrderItemModel"]] = relationship(
        back_populates="purchase_order", lazy="selectin", overlaps="items"
    )
    attachments: Mapped[list["PurchaseOrderAttachmentModel"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan", lazy="selectin"
    )


class PurchaseOrderItemModel(Base):
    __tablename__ = "purchase_order_line"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_order.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    unit_of_measure: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))

    purchase_order: Mapped["PurchaseOrderModel"] = relationship(back_populates="items")


class PurchaseOrderAttachmentModel(Base):
    __tablename__ = "purchase_order_attachment"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_order.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    purchase_order: Mapped["PurchaseOrderModel"] = relationship(back_populates="attachments")


class SupplierASNModel(Base):
    __tablename__ = "supplier_asns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asn_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    po_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_id: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    shipped_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    expected_arrival_date: Mapped[date] = mapped_column(Date, nullable=False)
    transporter_name: Mapped[str] = mapped_column(String(128), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(128), nullable=False)
    vehicle_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    driver_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    driver_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="SUBMITTED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["ASNItemModel"]] = relationship(
        back_populates="asn", cascade="all, delete-orphan", lazy="selectin"
    )


class ASNItemModel(Base):
    __tablename__ = "asn_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asn_id: Mapped[str] = mapped_column(ForeignKey("supplier_asns.id"), nullable=False)
    po_item_id: Mapped[str] = mapped_column(String(64), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ordered_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    shipped_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")
    batch_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    asn: Mapped["SupplierASNModel"] = relationship(back_populates="items")


class ArrivalNotificationModel(Base):
    __tablename__ = "arrival_notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asn_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    asn_number: Mapped[str] = mapped_column(String(64), nullable=False)
    po_id: Mapped[str] = mapped_column(String(64), nullable=False)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vehicle_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    expected_arrival_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    driver_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DISPATCHED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
