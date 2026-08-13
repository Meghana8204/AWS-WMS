"""
Pydantic v2 request/response schemas for procurement supplier module.
Inherits from ApiModel to automatically handle camelCase on the wire.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import Field
from app.common.api_model import ApiModel


class AddressSchema(ApiModel):
    registered_address: str = Field(min_length=1, description="Mandatory registered address")
    city: str = Field(min_length=1, description="Mandatory city")
    country: Optional[str] = Field(default=None, description="Optional country")
    state: Optional[str] = Field(default=None, description="Optional state/province")
    pincode: Optional[str] = Field(default=None, description="Optional pincode/zip")


class ContactSchema(ApiModel):
    primary_contact_name: str = Field(min_length=1, description="Mandatory primary contact name")
    email: str = Field(min_length=1, description="Mandatory email address")
    designation: Optional[str] = Field(default=None, description="Optional designation")
    phone: Optional[str] = Field(default=None, description="Optional phone number")
    website: Optional[str] = Field(default=None, description="Optional website URL")


class BankInfoSchema(ApiModel):
    bank_name: str = Field(min_length=1, description="Mandatory bank name")
    account_number: str = Field(min_length=1, description="Mandatory account number")
    account_holder_name: Optional[str] = Field(default=None, description="Optional account holder name")
    ifsc: Optional[str] = Field(default=None, description="Optional IFSC code")
    branch: Optional[str] = Field(default=None, description="Optional branch name")
    swift_bic: Optional[str] = Field(default=None, description="Optional SWIFT/BIC code")
    tds_section: Optional[str] = Field(default=None, description="Optional TDS section")


class DocumentSchema(ApiModel):
    upload_id: Optional[str] = Field(default=None, description="Staged upload UUID from POST /documents")
    document_type: str = Field(min_length=1, description="Mandatory document type")
    file_name: str = Field(min_length=1, description="Mandatory file name")
    file_type: str = Field(min_length=1, description="Mandatory file MIME/type")
    file_size: int = Field(gt=0, description="File size in bytes")



class CreateSupplierRequest(ApiModel):
    supplier_name: str = Field(min_length=1, description="Mandatory supplier name")
    registered_company_name: str = Field(min_length=1, description="Mandatory registered company name")
    vendor_type: str = Field(min_length=1, description="Mandatory vendor type")
    category: str = Field(min_length=1, description="Mandatory category (Vendor, Raw Materials, Products)")
    industry: str = Field(min_length=1, description="Mandatory industry")
    gstin: str = Field(min_length=1, description="Mandatory GSTIN number")
    supplier_code: Optional[str] = Field(default=None, description="Internal unique code")
    main_material: Optional[str] = Field(default=None, description="Primary material supplied")
    address: Optional[AddressSchema] = Field(default=None, description="Step 2 Address")
    contact: Optional[ContactSchema] = Field(default=None, description="Step 2 Contact")
    bank_info: Optional[BankInfoSchema] = Field(default=None, description="Step 3 Banking & Tax")
    documents: Optional[List[DocumentSchema]] = Field(default=None, description="Step 4 Uploaded Documents")
    remarks: Optional[str] = Field(default=None, description="Step 4 Remarks for Approver")


class DocumentUploadResponse(ApiModel):
    upload_id: str
    document_type: str
    file_name: str
    file_type: str
    file_size: int


class SupplierResponse(ApiModel):
    supplier_id: str
    supplier_name: str
    registered_company_name: str
    vendor_type: str
    category: str
    industry: str
    gstin: str
    supplier_code: Optional[str] = None
    main_material: Optional[str] = None
    rating: float = 0.0
    performance_score: float = 0.0
    city: Optional[str] = None
    address: Optional[AddressSchema] = None
    contact: Optional[ContactSchema] = None
    bank_info: Optional[BankInfoSchema] = None
    documents: Optional[List[DocumentSchema]] = None
    remarks: Optional[str] = None
    status: Optional[str] = None


# --- RFQ ---

class RfqItemSchema(ApiModel):
    material_code: str
    material_name: str
    category: str
    quantity: Decimal
    uom: str
    required_delivery_date: date
    warehouse: str
    special_requirements: Optional[str] = None


class CreateRfqRequest(ApiModel):
    rfq_date: date
    warehouse: str
    procurement_officer: str
    supplier_ids: List[str]
    items: List[RfqItemSchema]
    material_request_number: Optional[str] = None
    required_delivery_date: Optional[date] = None
    valid_until: Optional[date] = None
    remarks: Optional[str] = None


class RfqResponse(ApiModel):
    id: str
    rfq_number: str
    rfq_date: date
    warehouse: str
    procurement_officer: str
    status: str
    supplier_ids: List[str]
    items: List[RfqItemSchema]
    material_request_number: Optional[str] = None
    required_delivery_date: Optional[date] = None
    valid_until: Optional[date] = None
    remarks: Optional[str] = None
    created_at: datetime
    selected_supplier_id: Optional[str] = None
    selection_date: Optional[date] = None
    selected_by: Optional[str] = None
    selection_reason: Optional[str] = None
    selection_comments: Optional[str] = None


class SelectSupplierRequest(ApiModel):
    supplier_id: str
    selection_reason: str
    selection_comments: Optional[str] = None


# --- Quotation ---

class QuotationLineSchema(ApiModel):
    item_code: str
    quantity: Decimal
    unit_price: Decimal


class QuotationDocumentSchema(ApiModel):
    document_type: str
    file_name: str
    file_url: str


class SubmitQuotationRequest(ApiModel):
    rfq_id: str
    supplier_id: str
    lines: List[QuotationLineSchema]
    status: Optional[str] = "SUBMITTED"
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    freight_charges: Optional[Decimal] = None
    delivery_time: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    quotation_validity: Optional[date] = None
    remarks: Optional[str] = None
    documents: Optional[List[QuotationDocumentSchema]] = None


class QuotationResponse(ApiModel):
    id: str
    rfq_id: str
    supplier_id: str
    status: str
    lines: List[QuotationLineSchema]
    total_amount: Decimal
    created_at: datetime
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    freight_charges: Optional[Decimal] = None
    delivery_time: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    quotation_validity: Optional[date] = None
    remarks: Optional[str] = None
    documents: Optional[List[QuotationDocumentSchema]] = None


# --- Purchase Order ---

class PurchaseOrderLineSchema(ApiModel):
    item_code: str
    ordered_quantity: Decimal
    unit_price: Decimal
    material_name: Optional[str] = None
    category: Optional[str] = None
    uom: Optional[str] = None
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    line_total: Optional[Decimal] = None


class CreatePurchaseOrderRequest(ApiModel):
    quotation_id: Optional[str] = None
    supplier_id: str
    lines: List[PurchaseOrderLineSchema] = Field(alias="items")
    po_number: Optional[str] = None
    po_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    department: Optional[str] = None
    procurement_officer: Optional[str] = None
    delivery_warehouse: Optional[str] = None
    delivery_address: Optional[str] = None
    additional_charges: Decimal = Decimal("0.0")


class PurchaseOrderApprovalLogSchema(ApiModel):
    id: str
    status: str
    actor: str
    action_date: datetime
    reason: Optional[str] = None
    comments: Optional[str] = None


class PurchaseOrderSummarySchema(ApiModel):
    subtotal: Decimal
    total_discount: Decimal
    tax_amount: Decimal
    additional_charges: Decimal
    grand_total: Decimal


class PurchaseOrderResponse(ApiModel):
    id: str
    po_number: str
    quotation_id: Optional[str] = None
    supplier_id: str
    status: str
    lines: List[PurchaseOrderLineSchema] = Field(alias="items")
    po_date: date
    expected_delivery_date: Optional[date] = None
    created_at: datetime
    rejection_reason: Optional[str] = None
    finance_comments: Optional[str] = None
    logs: List[PurchaseOrderApprovalLogSchema] = []
    supplier_info: Optional[SupplierResponse] = None
    quotation_info: Optional[QuotationResponse] = None
    department: Optional[str] = "Procurement"
    procurement_officer: Optional[str] = "Procurement Officer"
    delivery_warehouse: Optional[str] = "Pune DC · Plant 1200"
    delivery_address: Optional[str] = "Sector 18, Industrial Area, Pune, MH, 411018"
    additional_charges: Decimal = Decimal("0.0")
    summary: PurchaseOrderSummarySchema


# --- ASN ---

class AsnLineSchema(ApiModel):
    item_code: str
    shipped_quantity: Decimal


class CreateAsnRequest(ApiModel):
    po_id: str
    asn_number: str
    lines: List[AsnLineSchema]
    vehicle_number: Optional[str] = None
    expected_arrival_at: Optional[datetime] = None
    shipment_date: Optional[date] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None


class AsnResponse(ApiModel):
    id: str
    po_id: str
    asn_number: str
    status: str
    lines: List[AsnLineSchema]
    vehicle_number: Optional[str] = None
    expected_arrival_at: Optional[datetime] = None
    shipment_date: Optional[date] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    created_at: datetime


# --- Supplier Auth ---

class SupplierLoginRequest(ApiModel):
    username: str
    password: str


class SupplierLoginResponse(ApiModel):
    token: str
    supplier_id: str
    must_change_password: bool
    username: str


class ChangePasswordRequest(ApiModel):
    username: str
    old_password: str
    new_password: str


class UpdateQuotationRequest(ApiModel):
    status: Optional[str] = None
    remarks: Optional[str] = None


class UpdatePurchaseOrderRequest(ApiModel):
    status: str
    rejection_reason: Optional[str] = None
    finance_comments: Optional[str] = None
    lines: Optional[List[PurchaseOrderLineSchema]] = None
    additional_charges: Optional[Decimal] = None


class DevLoginRequest(ApiModel):
    username: str
    password: str


class NotificationDispatchResponse(ApiModel):
    total_notifications_sent: int = 1
    status: str = "SENT"
    details: dict | List[dict]



