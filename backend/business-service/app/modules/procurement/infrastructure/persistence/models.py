"""
SQLAlchemy ORM models for procurement module.
Inherits from Base declarative base.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
import uuid

from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, GUID


# Association table for RFQ and Suppliers
rfq_supplier_link = Table(
    "rfq_supplier_link",
    Base.metadata,
    Column("rfq_id", GUID, ForeignKey("rfq.id"), primary_key=True),
    Column("supplier_id", GUID, ForeignKey("supplier.id"), primary_key=True),
)


class VendorTypeModel(Base):
    __tablename__ = "vendor_type"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)


class SupplierCategoryModel(Base):
    __tablename__ = "supplier_category"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)


class RawMaterialMasterModel(Base):
    __tablename__ = "raw_material_master"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)


class SupplierModel(Base):
    __tablename__ = "supplier"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_name: Mapped[str] = mapped_column(String(128), nullable=False)
    registered_company_name: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    vendor_type: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    industry: Mapped[str] = mapped_column(String(64), nullable=False)
    gstin: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    supplier_code: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    main_materials: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0.0, nullable=False)
    performance_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="Active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

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

    rfqs: Mapped[List["RfqModel"]] = relationship(
        "RfqModel", secondary=rfq_supplier_link, back_populates="suppliers"
    )


class SupplierAddressModel(Base):
    __tablename__ = "supplier_address"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    registered_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
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
    primary_email: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    secondary_email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, unique=True)
    website: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    supplier: Mapped["SupplierModel"] = relationship("SupplierModel", back_populates="contact")


class SupplierBankInfoModel(Base):
    __tablename__ = "supplier_bank_info"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False
    )
    bank_name: Mapped[str] = mapped_column(String(128), nullable=False)
    account_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
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
    file_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    upload_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

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

    suppliers: Mapped[List["SupplierModel"]] = relationship(
        "SupplierModel", secondary=rfq_supplier_link, back_populates="rfqs"
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
    required_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    warehouse: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
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
    supplier: Mapped[SupplierModel] = relationship()


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


class AsnModel(Base):
    __tablename__ = "asn"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, ForeignKey("supplier.id"), nullable=True)
    asn_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    po_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    po_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    warehouse_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    driver_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    driver_contact: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    expected_arrival_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    shipment_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    transporter: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    number_of_packages: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    package_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    shipping_method: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lines: Mapped[List[AsnLineModel]] = relationship(back_populates="asn", cascade="all, delete-orphan")
    documents: Mapped[List[AsnDocumentModel]] = relationship(back_populates="asn", cascade="all, delete-orphan")


class AsnDocumentModel(Base):
    __tablename__ = "asn_document"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    asn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("asn.id", ondelete="CASCADE"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    file_url: Mapped[str] = mapped_column(String(512), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(128), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    asn: Mapped[AsnModel] = relationship(back_populates="documents")


class AsnLineModel(Base):
    __tablename__ = "asn_line"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    asn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("asn.id"), nullable=False)
    item_code: Mapped[str] = mapped_column(String(64), nullable=False)
    shipped_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    material_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    uom: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    asn: Mapped[AsnModel] = relationship(back_populates="lines")


class PurchaseOrderModel(Base):
    __tablename__ = "purchase_order"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    po_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="CREATED")

    rfq_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, ForeignKey("rfq.id"), nullable=True)
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, ForeignKey("supplier.id"), nullable=True)

    supplier_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    warehouse_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    procurement_officer: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Supplier Info (Snapshot from Master at time of PO)
    supplier_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    supplier_contact_person: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    supplier_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    supplier_email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    supplier_gstin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    supplier_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Delivery Info
    delivery_warehouse_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Financial Summary
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    freight_charges: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    additional_charges: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))

    # Selection Audit
    selection_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    procurement_comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    selection_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.now)
    selected_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Approval Status
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    items: Mapped[List["PurchaseOrderItemModel"]] = relationship(
        "PurchaseOrderItemModel", back_populates="purchase_order", cascade="all, delete-orphan"
    )

    history: Mapped[List["POApprovalHistoryModel"]] = relationship(
        "POApprovalHistoryModel", back_populates="purchase_order", cascade="all, delete-orphan"
    )

    rfq: Mapped[Optional["RfqModel"]] = relationship("RfqModel")


class POApprovalHistoryModel(Base):
    __tablename__ = "po_approval_history"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("purchase_order.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_name: Mapped[str] = mapped_column(String(128), nullable=False)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    purchase_order: Mapped[PurchaseOrderModel] = relationship("PurchaseOrderModel", back_populates="history")


class PurchaseOrderItemModel(Base):
    __tablename__ = "purchase_order_item"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("purchase_order.id"), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    uom: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")

    purchase_order: Mapped[PurchaseOrderModel] = relationship("PurchaseOrderModel", back_populates="items")


class MaterialRequestModel(Base):
    __tablename__ = "material_request"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    request_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    department: Mapped[str] = mapped_column(String(64), nullable=False)
    requested_by: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    required_date: Mapped[date] = mapped_column(Date, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    items: Mapped[List["MaterialRequestItemModel"]] = relationship(
        "MaterialRequestItemModel", back_populates="request", cascade="all, delete-orphan"
    )


class MaterialRequestItemModel(Base):
    __tablename__ = "material_request_item"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("material_request.id"), nullable=False)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")

    request: Mapped[MaterialRequestModel] = relationship("MaterialRequestModel", back_populates="items")


class MaterialStockModel(Base):
    __tablename__ = "material_stock"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    material_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    on_hand: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    allocated: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    available: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0"))
    uom: Mapped[str] = mapped_column(String(32), nullable=False, default="PCS")
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    reorder_point: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("10.0"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class ArrivalNotificationModel(Base):
    __tablename__ = "arrival_notification"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    asn_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("asn.id", ondelete="CASCADE"), nullable=False)
    asn_number: Mapped[str] = mapped_column(String(64), nullable=False)
    po_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(128), nullable=False)
    vehicle_number: Mapped[str] = mapped_column(String(64), nullable=False)
    expected_arrival_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    driver_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recipients: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class NotificationModel(Base):
    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_role: Mapped[str] = mapped_column(String(32), nullable=False) # PROCUREMENT | FINANCE | WAREHOUSE
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class SupplierUserModel(Base):
    __tablename__ = "supplier_user"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    must_change_password: Mapped[bool] = mapped_column(default=False, nullable=False)

    supplier: Mapped[SupplierModel] = relationship("SupplierModel")


