"""
SQLAlchemy ORM models for procurement module.
Inherits from Base declarative base.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
import uuid

from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Numeric, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, GUID


# Association table for RFQ and Suppliers
rfq_supplier_link = Table(
    "rfq_supplier_link",
    Base.metadata,
    Column("rfq_id", GUID, ForeignKey("rfq.id"), primary_key=True),
    Column("supplier_id", GUID, ForeignKey("supplier.id"), primary_key=True),
)


class SupplierModel(Base):
    __tablename__ = "supplier"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_name: Mapped[str] = mapped_column(String(128), nullable=False)
    registered_company_name: Mapped[str] = mapped_column(String(256), nullable=False)
    vendor_type: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    industry: Mapped[str] = mapped_column(String(64), nullable=False)
    gstin: Mapped[str] = mapped_column(String(32), nullable=False)
    supplier_code: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    main_material: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0.0, nullable=False)
    performance_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="Active")

    address: Mapped[Optional["SupplierAddressModel"]] = relationship(
        "SupplierAddressModel", back_populates="supplier", uselist=False, cascade="all, delete-orphan"
    )
    contact: Mapped[Optional["SupplierContactModel"]] = relationship(
        "SupplierContactModel", back_populates="supplier", uselist=False, cascade="all, delete-orphan"
    )
    bank_info: Mapped[Optional["SupplierBankInfoModel"]] = relationship(
        "SupplierBankInfoModel", back_populates="supplier", uselist=False, cascade="all, delete-orphan"
    )
    documents: Mapped[List["SupplierDocumentModel"]] = relationship(
        "SupplierDocumentModel", back_populates="supplier", cascade="all, delete-orphan"
    )


class SupplierAddressModel(Base):
    __tablename__ = "supplier_address"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    registered_address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(64), nullable=False)
    country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    supplier: Mapped["SupplierModel"] = relationship("SupplierModel", back_populates="address")


class SupplierContactModel(Base):
    __tablename__ = "supplier_contact"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    primary_contact_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(128), nullable=False)
    designation: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    supplier: Mapped["SupplierModel"] = relationship("SupplierModel", back_populates="contact")


class SupplierBankInfoModel(Base):
    __tablename__ = "supplier_bank_info"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    bank_name: Mapped[str] = mapped_column(String(128), nullable=False)
    account_number: Mapped[str] = mapped_column(String(64), nullable=False)
    account_holder_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    ifsc: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    swift_bic: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    tds_section: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    supplier: Mapped["SupplierModel"] = relationship("SupplierModel", back_populates="bank_info")


class SupplierDocumentModel(Base):
    __tablename__ = "supplier_document"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)

    supplier: Mapped["SupplierModel"] = relationship("SupplierModel", back_populates="documents")


class MaterialModel(Base):
    __tablename__ = "material"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


# Association table for Supplier and Materials
supplier_material_link = Table(
    "supplier_material_link",
    Base.metadata,
    Column("supplier_id", GUID, ForeignKey("supplier.id", ondelete="CASCADE"), primary_key=True),
    Column("material_id", GUID, ForeignKey("material.id", ondelete="CASCADE"), primary_key=True),
)


class RfqModel(Base):
    __tablename__ = "rfq"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    rfq_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    rfq_date: Mapped[date] = mapped_column(Date, nullable=False)
    material_request_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    required_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    warehouse: Mapped[str] = mapped_column(String(128), nullable=False)
    procurement_officer: Mapped[str] = mapped_column(String(128), nullable=False)
    valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    closing_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Selection Fields
    selected_supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, ForeignKey("supplier.id"), nullable=True)
    selection_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    selected_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    selection_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    selection_comments: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    items: Mapped[List[RfqItemModel]] = relationship(
        "RfqItemModel", back_populates="rfq", cascade="all, delete-orphan"
    )


class RfqItemModel(Base):
    __tablename__ = "rfq_item"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    rfq_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("rfq.id", ondelete="CASCADE"), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(64), nullable=False)
    required_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    warehouse: Mapped[str] = mapped_column(String(128), nullable=False)
    special_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    rfq: Mapped[RfqModel] = relationship("RfqModel", back_populates="items")


class QuotationModel(Base):
    __tablename__ = "quotation"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    rfq_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("rfq.id"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("supplier.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    # Extended Bidding Fields
    discount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    tax: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    freight_charges: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    delivery_time: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    quotation_validity: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    lines: Mapped[List[QuotationLineModel]] = relationship(back_populates="quotation", cascade="all, delete-orphan")
    documents: Mapped[List[QuotationDocumentModel]] = relationship(back_populates="quotation", cascade="all, delete-orphan")


class QuotationDocumentModel(Base):
    __tablename__ = "quotation_document"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("quotation.id", ondelete="CASCADE"), nullable=False
    )
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    file_url: Mapped[str] = mapped_column(String(512), nullable=False)

    quotation: Mapped[QuotationModel] = relationship(back_populates="documents")


class QuotationLineModel(Base):
    __tablename__ = "quotation_line"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    quotation_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("quotation.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    quotation: Mapped[QuotationModel] = relationship(back_populates="lines")


class PurchaseOrderModel(Base):
    __tablename__ = "purchase_order"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    quotation_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, ForeignKey("quotation.id"), nullable=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("supplier.id"), nullable=False)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    po_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    # Rejection & Approval
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    finance_comments: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    procurement_officer: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    delivery_warehouse: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    additional_charges: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.0"), nullable=False)

    lines: Mapped[List[PurchaseOrderLineModel]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )
    logs: Mapped[List[PurchaseOrderApprovalLogModel]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderApprovalLogModel(Base):
    __tablename__ = "purchase_order_approval_log"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("purchase_order.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    action_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    comments: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    purchase_order: Mapped[PurchaseOrderModel] = relationship(back_populates="logs")


class PurchaseOrderLineModel(Base):
    __tablename__ = "purchase_order_line"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("purchase_order.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    material_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    uom: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    discount: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0.0"), nullable=False)

    purchase_order: Mapped[PurchaseOrderModel] = relationship(back_populates="lines")


class AsnModel(Base):
    __tablename__ = "asn"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("purchase_order.id"), nullable=False)
    asn_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    driver_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    driver_contact: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    expected_arrival_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    shipment_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lines: Mapped[List[AsnLineModel]] = relationship(back_populates="asn", cascade="all, delete-orphan")


class AsnLineModel(Base):
    __tablename__ = "asn_line"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    asn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("asn.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    shipped_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    asn: Mapped[AsnModel] = relationship(back_populates="lines")


class SupplierUserModel(Base):
    __tablename__ = "supplier_user"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    must_change_password: Mapped[bool] = mapped_column(default=True, nullable=False)

    supplier: Mapped[SupplierModel] = relationship("SupplierModel")


