from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Union

from pydantic import Field

from app.common.api_model import ApiModel


class MasterDataCreate(ApiModel):
    name: str


class MasterDataResponse(ApiModel):
    id: int
    name: str


class NotificationResponse(ApiModel):
    id: str
    user_role: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: datetime



class SupplierAddressResponse(ApiModel):
    registered_address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class SupplierContactResponse(ApiModel):
    primary_contact_name: Optional[str] = None
    primary_email: Optional[str] = None
    secondary_email: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None


class SupplierBankInfoResponse(ApiModel):
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    ifsc: Optional[str] = None
    branch: Optional[str] = None
    swift_bic: Optional[str] = None
    tds_section: Optional[str] = None


class SupplierDocumentResponse(ApiModel):
    document_type: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    storage_path: Optional[str] = None
    upload_id: Optional[str] = None


class SupplierResponse(ApiModel):
    supplier_id: str
    supplier_code: Optional[str] = None
    supplier_name: str
    registered_company_name: Optional[str] = None
    vendor_type: Optional[str] = None
    category: List[str] = []
    industry: Optional[str] = None
    gstin: Optional[str] = None
    main_materials: List[str] = []
    address: Optional[SupplierAddressResponse] = None
    contact: Optional[SupplierContactResponse] = None
    bank_info: Optional[SupplierBankInfoResponse] = None
    documents: List[SupplierDocumentResponse] = []
    remarks: Optional[str] = None
    status: Optional[str] = "Active"
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class AddressRequest(ApiModel):
    registered_address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = "India"
    state: Optional[str] = None
    pincode: Optional[str] = None


class ContactRequest(ApiModel):
    primary_contact_name: str
    primary_email: str
    secondary_email: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None


class BankInfoRequest(ApiModel):
    bank_name: str
    account_number: str
    account_holder_name: str
    ifsc: str
    branch: Optional[str] = None
    swift_bic: Optional[str] = None
    tds_section: Optional[str] = None


class DocumentRequest(ApiModel):
    document_type: str
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    storage_path: str
    upload_id: str


class CreateSupplierRequest(ApiModel):
    supplier_name: str
    registered_company_name: Optional[str] = None
    vendor_type: Optional[str] = None
    category: List[str] = []
    industry: Optional[str] = None
    gstin: Optional[str] = None
    main_materials: List[str] = []
    address: Optional[AddressRequest] = None
    contact: Optional[ContactRequest] = None
    bank_info: Optional[BankInfoRequest] = None
    documents: List[DocumentRequest] = []
    remarks: Optional[str] = None
    created_by: Optional[str] = None


class UpdateSupplierRequest(ApiModel):
    supplier_name: Optional[str] = None
    registered_company_name: Optional[str] = None
    vendor_type: Optional[str] = None
    category: Optional[List[str]] = None
    industry: Optional[str] = None
    gstin: Optional[str] = None
    main_materials: Optional[List[str]] = None
    address: Optional[AddressRequest] = None
    contact: Optional[ContactRequest] = None
    bank_info: Optional[BankInfoRequest] = None
    documents: Optional[List[DocumentRequest]] = None
    remarks: Optional[str] = None




class RfqItemSchema(ApiModel):
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    material_code: str
    variant_code: Optional[str] = None
    material_name: str
    category: Optional[str] = None
    quantity: Decimal
    uom: str
    required_delivery_date: Optional[date] = None
    warehouse: Optional[str] = None
    special_requirements: Optional[str] = None


class CreateRfqRequest(ApiModel):
    rfq_date: date
    material_request_number: Optional[str] = None
    required_delivery_date: Optional[date] = None
    warehouse: Optional[str] = None
    procurement_officer: Optional[str] = None
    remarks: Optional[str] = None
    supplier_ids: List[str]
    items: List[RfqItemSchema]


class RfqResponse(ApiModel):
    id: str
    rfq_number: str
    rfq_date: date
    material_request_number: Optional[str] = None
    required_delivery_date: Optional[date] = None
    warehouse: Optional[str] = None
    procurement_officer: Optional[str] = None
    remarks: Optional[str] = None
    status: str
    items: List[RfqItemSchema] = []
    suppliers: List[SupplierResponse] = []
    supplier_emails: List[str] = []
    created_at: Optional[datetime] = None




class QuotationLineSchema(ApiModel):
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    item_code: str
    variant_code: Optional[str] = None
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
    status: str = "SUBMITTED"
    discount: Decimal = Field(default=Decimal("0.0"), ge=0)
    tax: Decimal = Field(default=Decimal("0.0"), ge=0, le=100)
    freight_charges: Decimal = Field(default=Decimal("0.0"), ge=0)
    delivery_time: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    quotation_validity: Optional[date] = None
    remarks: Optional[str] = None
    documents: List[QuotationDocumentSchema] = []


class QuotationResponse(ApiModel):
    id: str
    rfq_id: Optional[str] = None
    supplier_id: Optional[str] = None
    status: Optional[str] = None
    lines: List[QuotationLineSchema] = []
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    freight_charges: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    delivery_time: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    quotation_validity: Optional[date] = None
    remarks: Optional[str] = None
    documents: List[QuotationDocumentSchema] = []
    supplier_info: Optional[SupplierResponse] = None
    created_at: Optional[datetime] = None




class AsnLineSchema(ApiModel):
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    item_code: str
    variant_code: Optional[str] = None
    shipped_quantity: Decimal
    material_name: Optional[str] = None
    uom: Optional[str] = None


class AsnDocumentSchema(ApiModel):
    document_type: str
    file_name: str
    file_url: str
    uploaded_by: str
    uploaded_at: Optional[datetime] = None


class CreateAsnRequest(ApiModel):
    asn_number: str
    lines: List[AsnLineSchema]
    po_id: Optional[str] = None
    po_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    expected_arrival_at: Optional[str] = None
    shipment_date: Optional[str] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    transporter: Optional[str] = None
    number_of_packages: Optional[int] = None
    package_type: Optional[str] = None
    shipping_method: Optional[str] = None
    status: Optional[str] = "SUBMITTED"
    documents: List[AsnDocumentSchema] = []


class AsnResponse(ApiModel):
    id: str
    asn_number: str
    status: str
    lines: List[AsnLineSchema]
    po_id: Optional[str] = None
    po_number: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    expected_arrival_at: Optional[datetime] = None
    shipment_date: Optional[date] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    transporter: Optional[str] = None
    number_of_packages: Optional[int] = None
    package_type: Optional[str] = None
    shipping_method: Optional[str] = None
    documents: List[AsnDocumentSchema] = []
    warehouse_status: Optional[str] = None
    warehouse_status_updated_at: Optional[datetime] = None
    assigned_dock_id: Optional[str] = None
    created_at: datetime




class POApprovalHistorySchema(ApiModel):
    status: str
    actor_name: str
    comments: Optional[str] = None
    created_at: datetime


class PurchaseOrderItemSchema(ApiModel):
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    material_code: str
    variant_code: Optional[str] = None
    material_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal = Decimal("0.0")
    tax: Decimal = Decimal("0.0")
    uom: str


class PurchaseOrderResponse(ApiModel):
    id: str
    po_number: str
    po_date: date
    status: str
    rfq_id: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    warehouse_id: Optional[str] = None
    total_amount: Decimal
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    procurement_officer: Optional[str] = None
    department: Optional[str] = None
    supplier_code: Optional[str] = None
    supplier_contact_person: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_gstin: Optional[str] = None
    supplier_address: Optional[str] = None
    delivery_warehouse_name: Optional[str] = None
    delivery_address: Optional[str] = None
    subtotal: Decimal = Decimal("0.0")
    discount_amount: Decimal = Decimal("0.0")
    tax_amount: Decimal = Decimal("0.0")
    freight_charges: Decimal = Decimal("0.0")
    additional_charges: Decimal = Decimal("0.0")
    rfq_number: Optional[str] = None
    tax_percentage: Decimal = Decimal("0.0")
    selection_reason: Optional[str] = None
    procurement_comments: Optional[str] = None
    selection_date: Optional[datetime] = None
    selected_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    items: List[PurchaseOrderItemSchema] = []
    history: List[POApprovalHistorySchema] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FinanceApprovalResponse(ApiModel):
    id: str
    po_id: str
    po_number: str
    rfq_id: Optional[str] = None
    rfq_number: Optional[str] = None
    supplier_name: str
    total_amount: Decimal
    status: str
    requested_by: str
    requested_at: datetime
    approved_at: Optional[datetime] = None
    approver_name: Optional[str] = None
    comments: Optional[str] = None
    po_details: Optional[PurchaseOrderResponse] = None




class MaterialRequestItemSchema(ApiModel):
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    material_code: Optional[str] = None
    variant_code: Optional[str] = None
    material_name: Optional[str] = None
    quantity: Decimal
    uom: str


class CreateMaterialRequest(ApiModel):
    request_number: Optional[str] = None
    warehouse_id: str
    department: str
    requested_by: str
    required_date: date
    remarks: Optional[str] = None
    items: List[MaterialRequestItemSchema]


class SupplierSelectionRequest(ApiModel):
    supplier_id: str
    selection_reason: str
    selection_comments: Optional[str] = None


class MaterialRequestResponse(ApiModel):
    id: str
    request_number: str
    warehouse_id: str
    department: str
    requested_by: str
    status: str
    required_date: date
    remarks: Optional[str] = None
    items: List[MaterialRequestItemSchema] = []
    created_at: datetime


class MaterialStockResponse(ApiModel):
    id: str
    material_id: Optional[str] = None
    material_variant_id: Optional[str] = None
    material_code: str
    variant_code: Optional[str] = None
    material_name: str
    category: str
    on_hand: Decimal
    allocated: Decimal
    available: Decimal
    uom: str
    warehouse_id: str
    reorder_point: Decimal
    updated_at: datetime


class ArrivalNotificationResponse(ApiModel):
    id: str
    asn_id: str
    asn_number: str
    po_id: Optional[str] = None
    po_number: str
    warehouse_id: str
    supplier_name: str
    vehicle_number: str
    expected_arrival_time: datetime
    driver_phone: Optional[str] = None
    message: Optional[str] = None
    status: str
    created_at: datetime




class ProcurementTrendItem(ApiModel):
    month: str
    pos: int


class ProcurementStatsResponse(ApiModel):
    active_suppliers: int
    total_suppliers: int
    open_pos: int
    compliance_rate: Optional[float] = None
    compliance_target: float
    total_po_value: Decimal
    trend: List[ProcurementTrendItem] = []


class GlobalSearchItem(ApiModel):
    id: str
    type: str
    title: str
    subtitle: str
    link: str


class GlobalSearchResponse(ApiModel):
    results: List[GlobalSearchItem]




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


class DevLoginRequest(ApiModel):
    username: str
    password: str
