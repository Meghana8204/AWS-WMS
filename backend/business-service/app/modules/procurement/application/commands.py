"""
CreateSupplierCommand - input DTO for CreateSupplierUseCase.
Plain, immutable dataclasses for Steps 1-4 supplier onboarding data.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional


@dataclass(frozen=True)
class AddressCommand:
    registered_address: str
    city: str
    country: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


@dataclass(frozen=True)
class ContactCommand:
    primary_contact_name: str
    email: str
    designation: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None


@dataclass(frozen=True)
class BankInfoCommand:
    bank_name: str
    account_number: str
    account_holder_name: Optional[str] = None
    ifsc: Optional[str] = None
    branch: Optional[str] = None
    swift_bic: Optional[str] = None
    tds_section: Optional[str] = None


@dataclass(frozen=True)
class DocumentCommand:
    document_type: str
    file_name: str
    file_type: str
    file_size: int
    storage_path: str
    upload_id: Optional[str] = None


@dataclass(frozen=True)
class CreateSupplierCommand:
    supplier_name: str
    registered_company_name: str
    vendor_type: str
    category: str
    industry: str
    gstin: str
    address: Optional[AddressCommand] = None
    contact: Optional[ContactCommand] = None
    bank_info: Optional[BankInfoCommand] = None
    documents: Optional[List[DocumentCommand]] = None
    remarks: Optional[str] = None


# --- RFQ ---

@dataclass(frozen=True)
class RfqItemCommand:
    material_code: str
    material_name: str
    category: str
    quantity: Decimal
    uom: str
    required_delivery_date: date
    warehouse: str
    special_requirements: Optional[str] = None


@dataclass(frozen=True)
class CreateRfqCommand:
    rfq_date: date
    warehouse: str
    procurement_officer: str
    supplier_ids: List[str]
    items: List[RfqItemCommand]
    material_request_number: Optional[str] = None
    required_delivery_date: Optional[date] = None
    valid_until: Optional[date] = None
    remarks: Optional[str] = None


# --- Quotation ---

@dataclass(frozen=True)
class QuotationLineCommand:
    item_code: str
    quantity: Decimal
    unit_price: Decimal


@dataclass(frozen=True)
class QuotationDocumentCommand:
    document_type: str
    file_name: str
    file_url: str


@dataclass(frozen=True)
class SubmitQuotationCommand:
    rfq_id: str
    supplier_id: str
    lines: List[QuotationLineCommand]
    status: str = "SUBMITTED"
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    freight_charges: Optional[Decimal] = None
    delivery_time: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    quotation_validity: Optional[date] = None
    remarks: Optional[str] = None
    documents: Optional[List[QuotationDocumentCommand]] = None


# --- Purchase Order ---

@dataclass(frozen=True)
class PurchaseOrderLineCommand:
    item_code: str
    ordered_quantity: Decimal
    unit_price: Decimal
    material_name: Optional[str] = None
    category: Optional[str] = None
    uom: Optional[str] = None
    discount: Decimal = Decimal("0.0")
    tax: Decimal = Decimal("0.0")


@dataclass(frozen=True)
class CreatePurchaseOrderCommand:
    supplier_id: str
    lines: List[PurchaseOrderLineCommand]
    quotation_id: Optional[str] = None
    po_number: Optional[str] = None
    po_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    department: Optional[str] = None
    procurement_officer: Optional[str] = None
    delivery_warehouse: Optional[str] = None
    delivery_address: Optional[str] = None
    additional_charges: Decimal = Decimal("0.0")


@dataclass(frozen=True)
class UpdatePurchaseOrderCommand:
    status: Optional[str] = None
    rejection_reason: Optional[str] = None
    finance_comments: Optional[str] = None
    lines: Optional[List[PurchaseOrderLineCommand]] = None
    additional_charges: Optional[Decimal] = None


# --- ASN ---

@dataclass(frozen=True)
class AsnLineCommand:
    item_code: str
    shipped_quantity: Decimal


@dataclass(frozen=True)
class CreateAsnCommand:
    po_id: str
    asn_number: str
    lines: List[AsnLineCommand]
    vehicle_number: Optional[str] = None
    expected_arrival_at: Optional[datetime] = None
    shipment_date: Optional[date] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
