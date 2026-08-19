"""
Pydantic API schemas for procurement Purchase Order endpoints & pipeline stages.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SupplierInfoSchema(BaseModel):
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    supplier_address: Optional[str] = None


class DeliveryDetailsSchema(BaseModel):
    delivery_warehouse: Optional[str] = None
    delivery_address: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    transporter: Optional[str] = None


class OrderItemRequestSchema(BaseModel):
    material_code: str = Field(..., description="Material Code")
    material_name: Optional[str] = Field(None, description="Material Name")
    category: Optional[str] = Field(None, description="Material Category")
    unit_of_measure: str = Field("PCS", description="Unit of Measure")
    quantity: Decimal = Field(..., description="Quantity ordered (> 0)")
    unit_price: Decimal = Field(Decimal("0.0"), description="Unit Price")
    discount: Decimal = Field(Decimal("0.0"), description="Discount")
    tax: Decimal = Field(Decimal("0.0"), description="Tax")


OrderItemSchema = OrderItemRequestSchema


class OrderItemResponseSchema(BaseModel):
    id: str
    material_code: str
    material_name: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: str
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal
    tax: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class AttachmentResponseSchema(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size_bytes: int
    category: str
    created_at: datetime
    download_url: str


class OrderSummarySchema(BaseModel):
    total_items: int
    total_quantity: Decimal
    subtotal: Decimal
    total_discount: Decimal
    tax_amount: Decimal
    additional_charges: Decimal
    grand_total: Decimal


class CreatePurchaseOrderRequestSchema(BaseModel):
    supplier_id: str = Field(..., description="Supplier ID")
    warehouse_id: str = Field(..., description="Warehouse ID")
    expected_delivery_date: date = Field(..., description="Expected Delivery Date")
    po_number: Optional[str] = Field(None, description="Auto-generated if missing")
    po_date: Optional[date] = Field(None, description="PO Date")
    department: Optional[str] = Field(None, description="Department")
    buyer: Optional[str] = Field(None, description="Buyer Name")
    payment_terms: Optional[str] = Field("NET30", description="Payment Terms")
    rfq_id: Optional[str] = Field(None, description="RFQ ID")
    quotation_id: Optional[str] = Field(None, description="Quotation ID")
    material_request_ids: Optional[list[str]] = Field(None, description="Material Request IDs")
    supplier_info: Optional[SupplierInfoSchema] = None
    delivery_details: Optional[DeliveryDetailsSchema] = None
    items: list[OrderItemRequestSchema] = Field(default_factory=list)
    tax_rate: Decimal = Field(Decimal("0.18"), description="GST Tax Rate")
    additional_charges: Decimal = Field(Decimal("0.0"), description="Additional Charges")


class SaveDraftPurchaseOrderRequestSchema(BaseModel):
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    po_number: Optional[str] = None
    po_date: Optional[date] = None
    department: Optional[str] = None
    buyer: Optional[str] = None
    payment_terms: Optional[str] = "NET30"
    rfq_id: Optional[str] = None
    quotation_id: Optional[str] = None
    supplier_info: Optional[SupplierInfoSchema] = None
    delivery_details: Optional[DeliveryDetailsSchema] = None
    items: list[OrderItemRequestSchema] = Field(default_factory=list)
    tax_rate: Decimal = Decimal("0.18")
    additional_charges: Decimal = Decimal("0.0")


class UpdatePurchaseOrderRequestSchema(BaseModel):
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    department: Optional[str] = None
    buyer: Optional[str] = None
    status: Optional[str] = None
    supplier_info: Optional[SupplierInfoSchema] = None
    delivery_details: Optional[DeliveryDetailsSchema] = None
    items: Optional[list[OrderItemRequestSchema]] = None
    additional_charges: Optional[Decimal] = None


class PurchaseOrderResponseSchema(BaseModel):
    id: str
    po_number: str
    po_date: date
    status: str
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    department: Optional[str] = None
    buyer: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    rfq_id: Optional[str] = None
    quotation_id: Optional[str] = None
    finance_approval_id: Optional[str] = None
    supplier_info: Optional[SupplierInfoSchema] = None
    delivery_details: Optional[DeliveryDetailsSchema] = None
    items: list[OrderItemResponseSchema] = Field(default_factory=list)
    attachments: list[AttachmentResponseSchema] = Field(default_factory=list)
    tax_rate: Decimal
    summary: OrderSummarySchema
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderListResponseSchema(BaseModel):
    items: list[PurchaseOrderResponseSchema]
    total: int
    limit: int
    offset: int


# --- Pipeline Stage API Schemas ---

class MaterialRequestItemSchema(BaseModel):
    material_code: str
    material_name: str
    requested_qty: Decimal
    category: str = "Raw Material"
    unit_of_measure: str = "PCS"
    estimated_unit_cost: Decimal = Decimal("0.00")
    notes: Optional[str] = None


class CreateMaterialRequestSchema(BaseModel):
    warehouse_id: str
    department: str
    requested_by: str
    target_delivery_date: date
    items: list[MaterialRequestItemSchema]
    priority: str = "MEDIUM"


MaterialRequestCreateSchema = CreateMaterialRequestSchema


class MaterialRequestResponseSchema(BaseModel):
    id: str
    request_number: str
    warehouse_id: str
    department: str
    requested_by: str
    target_delivery_date: date
    priority: str
    status: str
    rejection_reason: Optional[str] = None
    items: list[MaterialRequestItemSchema]
    total_estimated_cost: Decimal
    created_at: datetime
    updated_at: datetime


class RFQItemSchema(BaseModel):
    material_code: str
    material_name: str
    quantity: Decimal
    unit_of_measure: str = "PCS"


class RFQSupplierSchema(BaseModel):
    supplier_id: str
    supplier_code: str
    supplier_name: str
    email: Optional[str] = None


class CreateRFQSchema(BaseModel):
    title: str
    warehouse_id: str
    due_date: date
    items: list[RFQItemSchema]
    invited_suppliers: list[RFQSupplierSchema]
    material_request_ids: Optional[list[str]] = None
    terms_and_conditions: Optional[str] = None


RFQCreateSchema = CreateRFQSchema


class RFQResponseSchema(BaseModel):
    id: str
    rfq_number: str
    title: str
    warehouse_id: str
    issue_date: date
    due_date: date
    status: str
    material_request_ids: list[str]
    terms_and_conditions: Optional[str] = None
    items: list[RFQItemSchema]
    invited_suppliers: list[RFQSupplierSchema]
    created_at: datetime
    updated_at: datetime


class QuotationItemSchema(BaseModel):
    material_code: str
    material_name: str
    offered_qty: Decimal
    unit_price: Decimal
    tax_rate: Decimal = Decimal("0.18")
    discount_percent: Decimal = Decimal("0.00")


class QuotationSubmitSchema(BaseModel):
    rfq_id: str
    supplier_id: str
    supplier_code: str
    supplier_name: str
    valid_until: date
    items: list[QuotationItemSchema]
    payment_terms: str = "NET30"
    delivery_lead_time_days: int = 7


class QuotationResponseSchema(BaseModel):
    id: str
    quotation_number: str
    rfq_id: str
    supplier_id: str
    supplier_code: str
    supplier_name: str
    submission_date: date
    valid_until: date
    payment_terms: str
    delivery_lead_time_days: int
    status: str
    rejection_reason: Optional[str] = None
    items: list[QuotationItemSchema]
    subtotal: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    created_at: datetime
    updated_at: datetime


class SelectQuotationSchema(BaseModel):
    selected_by: str
    selection_notes: Optional[str] = None


class FinanceApprovalDecisionSchema(BaseModel):
    approver_id: str
    approver_name: str
    notes_or_reason: str = Field(..., description="Approval notes or Rejection reason")


class FinanceApprovalResponseSchema(BaseModel):
    id: str
    po_id: str
    po_number: str
    total_amount: Decimal
    requested_by: str
    budget_code: Optional[str] = None
    currency: str
    status: str
    approver_id: Optional[str] = None
    approver_name: Optional[str] = None
    approval_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    requires_cfo_approval: bool
    created_at: datetime
    updated_at: datetime


class ASNItemSchema(BaseModel):
    po_item_id: str
    material_code: str
    material_name: str
    ordered_qty: Decimal
    shipped_qty: Decimal
    unit_of_measure: str = "PCS"
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None


class ASNSubmitSchema(BaseModel):
    po_id: str
    po_number: str
    supplier_id: str
    supplier_name: str
    warehouse_id: str
    expected_arrival_date: date
    transporter_name: str
    tracking_number: str
    vehicle_number: str
    items: list[ASNItemSchema]
    attachments: list[AttachmentResponseSchema] = Field(default_factory=list)
    shipped_date: Optional[date] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None


class ASNResponseSchema(BaseModel):
    id: str
    asn_number: str
    po_id: str
    po_number: str
    supplier_id: str
    supplier_name: str
    warehouse_id: str
    shipped_date: date
    expected_arrival_date: date
    transporter_name: str
    tracking_number: str
    vehicle_number: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    status: str
    items: list[ASNItemSchema]
    attachments: list[AttachmentResponseSchema] = Field(default_factory=list)
    total_shipped_qty: Decimal
    created_at: datetime
    updated_at: datetime


class ArrivalNotificationResponseSchema(BaseModel):
    id: str
    asn_id: str
    asn_number: str
    po_id: str
    po_number: str
    warehouse_id: str
    supplier_name: str
    vehicle_number: str
    expected_arrival_time: datetime
    driver_phone: Optional[str] = None
    status: str
    notified_recipients: list[str]
    created_at: datetime


class ResubmitPurchaseOrderRequestSchema(BaseModel):
    resubmitted_by: str
    items: Optional[list[OrderItemSchema]] = None
    tax_rate: Optional[Decimal] = None


class ComparisonMatrixResponseSchema(BaseModel):
    rfq_id: str
    rfq_number: str
    title: str
    total_quotations: int
    best_recommendation_supplier_id: Optional[str] = None
    suppliers: list[dict]
    items: list[dict]


class NotificationDispatchResponseSchema(BaseModel):
    total_notifications_sent: int = 1
    status: str = "SENT"
    details: dict | list
