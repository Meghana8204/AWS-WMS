"""
Commands for procurement use cases.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


@dataclass(frozen=True)
class SupplierInfoDTO:
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    supplier_address: Optional[str] = None


@dataclass(frozen=True)
class DeliveryDetailsDTO:
    delivery_warehouse: Optional[str] = None
    delivery_address: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    transporter: Optional[str] = None


@dataclass(frozen=True)
class OrderItemDTO:
    material_code: str
    material_name: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: str = "PCS"
    quantity: Decimal = Decimal("0.0")
    unit_price: Decimal = Decimal("0.0")
    discount: Decimal = Decimal("0.0")
    tax: Decimal = Decimal("0.0")


@dataclass(frozen=True)
class CreatePurchaseOrderCommand:
    supplier_id: str
    warehouse_id: str
    expected_delivery_date: date
    po_number: Optional[str] = None
    po_date: Optional[date] = None
    department: Optional[str] = None
    buyer: Optional[str] = None
    supplier_info: Optional[SupplierInfoDTO] = None
    delivery_details: Optional[DeliveryDetailsDTO] = None
    items: list[OrderItemDTO] = None
    tax_rate: Decimal = Decimal("0.18")
    additional_charges: Decimal = Decimal("0.0")
    payment_terms: Optional[str] = "NET30"
    rfq_id: Optional[str] = None
    quotation_id: Optional[str] = None
    material_request_ids: Optional[list[str]] = None


@dataclass(frozen=True)
class SaveDraftPurchaseOrderCommand:
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    po_number: Optional[str] = None
    po_date: Optional[date] = None
    department: Optional[str] = None
    buyer: Optional[str] = None
    supplier_info: Optional[SupplierInfoDTO] = None
    delivery_details: Optional[DeliveryDetailsDTO] = None
    items: list[OrderItemDTO] = None
    tax_rate: Decimal = Decimal("0.18")
    additional_charges: Decimal = Decimal("0.0")
    payment_terms: Optional[str] = "NET30"
    rfq_id: Optional[str] = None
    quotation_id: Optional[str] = None


@dataclass(frozen=True)
class UpdatePurchaseOrderCommand:
    po_id: str
    supplier_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    department: Optional[str] = None
    buyer: Optional[str] = None
    supplier_info: Optional[SupplierInfoDTO] = None
    delivery_details: Optional[DeliveryDetailsDTO] = None
    items: Optional[list[OrderItemDTO]] = None
    status: Optional[str] = None
    additional_charges: Optional[Decimal] = None


@dataclass(frozen=True)
class UploadAttachmentCommand:
    po_id: str
    filename: str
    file_type: str
    file_content: bytes
    category: str


# --- Pipeline Stage Commands ---

@dataclass(frozen=True)
class MaterialRequestItemDTO:
    material_code: str
    material_name: str
    requested_qty: Decimal
    category: str = "Raw Material"
    unit_of_measure: str = "PCS"
    estimated_unit_cost: Decimal = Decimal("0.00")
    notes: Optional[str] = None


@dataclass(frozen=True)
class CreateMaterialRequestCommand:
    warehouse_id: str
    department: str
    requested_by: str
    target_delivery_date: date
    items: list[MaterialRequestItemDTO]
    priority: str = "MEDIUM"


@dataclass(frozen=True)
class RFQItemDTO:
    material_code: str
    material_name: str
    quantity: Decimal
    unit_of_measure: str = "PCS"


@dataclass(frozen=True)
class RFQSupplierDTO:
    supplier_id: str
    supplier_code: str
    supplier_name: str
    email: Optional[str] = None


@dataclass(frozen=True)
class CreateRFQCommand:
    title: str
    warehouse_id: str
    due_date: date
    items: list[RFQItemDTO]
    invited_suppliers: list[RFQSupplierDTO]
    material_request_ids: Optional[list[str]] = None
    terms_and_conditions: Optional[str] = None


@dataclass(frozen=True)
class QuotationItemDTO:
    material_code: str
    material_name: str
    offered_qty: Decimal
    unit_price: Decimal
    tax_rate: Decimal = Decimal("0.18")
    discount_percent: Decimal = Decimal("0.00")


@dataclass(frozen=True)
class SubmitQuotationCommand:
    rfq_id: str
    supplier_id: str
    supplier_code: str
    supplier_name: str
    valid_until: date
    items: list[QuotationItemDTO]
    payment_terms: str = "NET30"
    delivery_lead_time_days: int = 7


@dataclass(frozen=True)
class SelectQuotationCommand:
    rfq_id: str
    quotation_id: str
    selected_by: str
    selection_notes: Optional[str] = None


@dataclass(frozen=True)
class ApproveFinanceCommand:
    approval_id: str
    approver_id: str
    approver_name: str
    notes: Optional[str] = None


@dataclass(frozen=True)
class RejectFinanceCommand:
    approval_id: str
    approver_id: str
    approver_name: str
    reason: str


@dataclass(frozen=True)
class ASNItemDTO:
    po_item_id: str
    material_code: str
    material_name: str
    ordered_qty: Decimal
    shipped_qty: Decimal
    unit_of_measure: str = "PCS"
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None


@dataclass(frozen=True)
class ASNAttachmentDTO:
    filename: str
    file_type: str
    file_size_bytes: int
    category: str
    attachment_id: str
    created_at: datetime


@dataclass(frozen=True)
class SubmitASNCommand:
    po_id: str
    po_number: str
    supplier_id: str
    supplier_name: str
    warehouse_id: str
    expected_arrival_date: date
    transporter_name: str
    tracking_number: str
    vehicle_number: str
    items: list[ASNItemDTO]
    attachments: list[ASNAttachmentDTO] = None
    shipped_date: Optional[date] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None


@dataclass(frozen=True)
class ResubmitPurchaseOrderCommand:
    po_id: str
    resubmitted_by: str
    items: Optional[list[OrderItemDTO]] = None
    tax_rate: Optional[Decimal] = None


@dataclass(frozen=True)
class SendRFQEmailsCommand:
    rfq_id: str
    base_url: str = "http://localhost:3000"


@dataclass(frozen=True)
class SendPOSupplierEmailCommand:
    po_id: str
    base_url: str = "http://localhost:3000"
