"""
PurchaseOrder Aggregate Root.
Domain rules:
- Auto generates po_number if missing (e.g. PO-YYYYMMDD-XXXX)
- Validates mandatory fields when creating PO (* Supplier, Warehouse, Expected Delivery Date, Quantity > 0)
- Relaxed validation when saving as DRAFT
- Maintains line items, attachments, pipeline linkages, and computed order summary
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
import random
import string
import uuid

from app.modules.procurement.domain.attachment import PurchaseOrderAttachment
from app.modules.procurement.domain.delivery_details import DeliveryDetails
from app.modules.procurement.domain.events import (
    PurchaseOrderCancelledEvent,
    PurchaseOrderCreatedEvent,
    PurchaseOrderDraftSavedEvent,
    PurchaseOrderUpdatedEvent,
)
from app.modules.procurement.domain.purchase_order_item import PurchaseOrderItem
from app.modules.procurement.domain.purchase_order_status import PurchaseOrderStatus
from app.modules.procurement.domain.supplier_info import SupplierInfo
from app.modules.procurement.domain.value_objects import PurchaseOrderId


def generate_po_number(sequence: int = 1) -> str:
    current_year = date.today().year
    seq_str = str(sequence).zfill(4)
    return f"PO-{current_year}-{seq_str}"


class PurchaseOrderValidationError(ValueError):
    """Raised when domain validation fails for creating/updating a Purchase Order."""
    pass


@dataclass
class PurchaseOrder:
    id: PurchaseOrderId
    po_number: str
    po_date: date
    status: PurchaseOrderStatus
    supplier_id: str | None = None
    warehouse_id: str | None = None
    department: str | None = None
    buyer: str | None = None
    expected_delivery_date: date | None = None
    payment_terms: str | None = "NET30"
    rfq_id: str | None = None
    quotation_id: str | None = None
    finance_approval_id: str | None = None
    material_request_ids: list[str] = field(default_factory=list)
    supplier_info: SupplierInfo = field(default_factory=SupplierInfo)
    delivery_details: DeliveryDetails = field(default_factory=DeliveryDetails)
    items: list[PurchaseOrderItem] = field(default_factory=list)
    attachments: list[PurchaseOrderAttachment] = field(default_factory=list)
    tax_rate: Decimal = Decimal("0.18")
    additional_charges: Decimal = Decimal("0.0")
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    recorded_events: list[object] = field(default_factory=list, repr=False)

    @classmethod
    def create(
        cls,
        supplier_id: str,
        warehouse_id: str,
        expected_delivery_date: date,
        po_number: str | None = None,
        po_date: date | None = None,
        department: str | None = None,
        buyer: str | None = None,
        supplier_info: SupplierInfo | None = None,
        delivery_details: DeliveryDetails | None = None,
        items: list[PurchaseOrderItem] | None = None,
        attachments: list[PurchaseOrderAttachment] | None = None,
        tax_rate: Decimal = Decimal("0.18"),
        additional_charges: Decimal = Decimal("0.0"),
        payment_terms: str | None = "NET30",
        rfq_id: str | None = None,
        quotation_id: str | None = None,
        material_request_ids: list[str] | None = None,
        po_id: PurchaseOrderId | None = None,
    ) -> "PurchaseOrder":
        """
        Creates a new active Purchase Order (Status = CREATED).
        Enforces required fields (*).
        """
        if not supplier_id or not supplier_id.strip():
            raise PurchaseOrderValidationError("Supplier is required")
        if not warehouse_id or not warehouse_id.strip():
            raise PurchaseOrderValidationError("Warehouse is required")
        if not expected_delivery_date:
            raise PurchaseOrderValidationError("Expected Delivery Date is required")

        item_list = items or []
        if not item_list:
            raise PurchaseOrderValidationError("At least one order item is required")

        for item in item_list:
            if item.quantity <= Decimal("0"):
                raise PurchaseOrderValidationError(
                    f"Item quantity for '{item.material_code}' must be greater than zero"
                )

        order_id = po_id or PurchaseOrderId.generate()
        number = po_number or generate_po_number()
        order_date = po_date or date.today()
        supp_info = supplier_info or SupplierInfo(supplier_code=supplier_id)
        deliv_info = delivery_details or DeliveryDetails(
            delivery_warehouse=warehouse_id, expected_delivery_date=expected_delivery_date
        )

        po = cls(
            id=order_id,
            po_number=number,
            po_date=order_date,
            status=PurchaseOrderStatus.CREATED,
            supplier_id=supplier_id,
            warehouse_id=warehouse_id,
            department=department,
            buyer=buyer,
            expected_delivery_date=expected_delivery_date,
            payment_terms=payment_terms,
            rfq_id=rfq_id,
            quotation_id=quotation_id,
            material_request_ids=material_request_ids or [],
            supplier_info=supp_info,
            delivery_details=deliv_info,
            items=item_list,
            attachments=attachments or [],
            tax_rate=tax_rate,
            additional_charges=additional_charges,
        )

        po.recorded_events.append(
            PurchaseOrderCreatedEvent(
                po_id=po.id.value,
                po_number=po.po_number,
                status=po.status.value,
                supplier_name=supp_info.supplier_name,
                warehouse_id=po.warehouse_id,
            )
        )
        return po

    @classmethod
    def save_draft(
        cls,
        supplier_id: str | None = None,
        warehouse_id: str | None = None,
        expected_delivery_date: date | None = None,
        po_number: str | None = None,
        po_date: date | None = None,
        department: str | None = None,
        buyer: str | None = None,
        supplier_info: SupplierInfo | None = None,
        delivery_details: DeliveryDetails | None = None,
        items: list[PurchaseOrderItem] | None = None,
        attachments: list[PurchaseOrderAttachment] | None = None,
        tax_rate: Decimal = Decimal("0.18"),
        additional_charges: Decimal = Decimal("0.0"),
        payment_terms: str | None = "NET30",
        rfq_id: str | None = None,
        quotation_id: str | None = None,
        po_id: PurchaseOrderId | None = None,
    ) -> "PurchaseOrder":
        order_id = po_id or PurchaseOrderId.generate()
        number = po_number or generate_po_number()
        order_date = po_date or date.today()

        po = cls(
            id=order_id,
            po_number=number,
            po_date=order_date,
            status=PurchaseOrderStatus.DRAFT,
            supplier_id=supplier_id,
            warehouse_id=warehouse_id,
            department=department,
            buyer=buyer,
            expected_delivery_date=expected_delivery_date,
            payment_terms=payment_terms,
            rfq_id=rfq_id,
            quotation_id=quotation_id,
            supplier_info=supplier_info or SupplierInfo(),
            delivery_details=delivery_details or DeliveryDetails(),
            items=items or [],
            attachments=attachments or [],
            tax_rate=tax_rate,
            additional_charges=additional_charges,
        )

        po.recorded_events.append(
            PurchaseOrderDraftSavedEvent(
                po_id=po.id.value,
                po_number=po.po_number,
                status=po.status.value,
            )
        )
        return po

    def submit_for_finance_approval(self, approval_id: str) -> None:
        self.finance_approval_id = approval_id
        self.status = PurchaseOrderStatus.PENDING_FINANCE_APPROVAL
        self.updated_at = datetime.now(timezone.utc)

    def finance_approve(self) -> None:
        self.status = PurchaseOrderStatus.APPROVED
        self.updated_at = datetime.now(timezone.utc)

    def finance_reject(self) -> None:
        self.status = PurchaseOrderStatus.FINANCE_REJECTED
        self.updated_at = datetime.now(timezone.utc)

    def resubmit_for_finance_approval(
        self,
        approval_id: str,
        items: list[PurchaseOrderItem] | None = None,
        tax_rate: Decimal | None = None,
    ) -> None:
        if self.status not in (PurchaseOrderStatus.FINANCE_REJECTED, PurchaseOrderStatus.DRAFT):
            raise PurchaseOrderValidationError(f"Cannot resubmit purchase order in status {self.status.value}")
        if items is not None:
            self.items = items
        if tax_rate is not None:
            self.tax_rate = tax_rate
        self.finance_approval_id = approval_id
        self.status = PurchaseOrderStatus.PENDING_FINANCE_APPROVAL
        self.updated_at = datetime.now(timezone.utc)

    def issue(self) -> None:
        self.status = PurchaseOrderStatus.ISSUED
        self.updated_at = datetime.now(timezone.utc)

    def acknowledge_by_supplier(self) -> None:
        self.status = PurchaseOrderStatus.ACKNOWLEDGED
        self.updated_at = datetime.now(timezone.utc)

    def update(
        self,
        supplier_id: str | None = None,
        warehouse_id: str | None = None,
        expected_delivery_date: date | None = None,
        department: str | None = None,
        buyer: str | None = None,
        supplier_info: SupplierInfo | None = None,
        delivery_details: DeliveryDetails | None = None,
        items: list[PurchaseOrderItem] | None = None,
        status: PurchaseOrderStatus | None = None,
        additional_charges: Decimal | None = None,
    ) -> None:
        if self.status == PurchaseOrderStatus.CANCELLED:
            raise PurchaseOrderValidationError("Cannot update a cancelled Purchase Order")

        if supplier_id is not None:
            self.supplier_id = supplier_id
        if warehouse_id is not None:
            self.warehouse_id = warehouse_id
        if expected_delivery_date is not None:
            self.expected_delivery_date = expected_delivery_date
        if department is not None:
            self.department = department
        if buyer is not None:
            self.buyer = buyer
        if supplier_info is not None:
            self.supplier_info = supplier_info
        if delivery_details is not None:
            self.delivery_details = delivery_details
        if items is not None:
            self.items = items
        if status is not None:
            self.status = status
        if additional_charges is not None:
            self.additional_charges = additional_charges

        self.updated_at = datetime.now(timezone.utc)
        self.recorded_events.append(
            PurchaseOrderUpdatedEvent(
                po_id=self.id.value,
                po_number=self.po_number,
                status=self.status.value,
            )
        )

    def cancel(self) -> None:
        if self.status == PurchaseOrderStatus.CANCELLED:
            return
        self.status = PurchaseOrderStatus.CANCELLED
        self.updated_at = datetime.now(timezone.utc)
        self.recorded_events.append(
            PurchaseOrderCancelledEvent(po_id=self.id.value, po_number=self.po_number)
        )

    def add_attachment(self, attachment: PurchaseOrderAttachment) -> None:
        self.attachments.append(attachment)
        self.updated_at = datetime.now(timezone.utc)

    # --- Section 6: ORDER SUMMARY (Calculated Properties) -----------------------

    @property
    def total_items(self) -> int:
        return len(self.items)

    @property
    def total_quantity(self) -> Decimal:
        return sum((item.quantity for item in self.items), Decimal("0.0"))

    @property
    def subtotal(self) -> Decimal:
        return sum((item.gross_amount for item in self.items), Decimal("0.0"))

    @property
    def total_discount(self) -> Decimal:
        return sum((item.discount for item in self.items), Decimal("0.0"))

    @property
    def tax_amount(self) -> Decimal:
        return sum((item.tax for item in self.items), Decimal("0.0"))

    @property
    def grand_total(self) -> Decimal:
        return self.subtotal - self.total_discount + self.tax_amount + self.additional_charges
