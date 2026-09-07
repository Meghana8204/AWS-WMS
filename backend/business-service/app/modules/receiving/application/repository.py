"""
GrnRepository - outbound port, counterpart of GrnRepository.java (interface).
The application layer below depends only on this Protocol; it has no idea
whether the implementation talks to PostgreSQL or anything else. Swapping
databases means writing a new implementation of this interface - nothing
in this file or in ConfirmGrnUseCase changes.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional, Protocol

from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.value_objects import GrnId, PurchaseOrderId


@dataclass(frozen=True)
class PurchaseOrderLineSnapshot:
    item_code: str
    ordered_quantity: Decimal
    material_name: str | None = None
    material_category: str | None = None
    uom: str | None = None


@dataclass(frozen=True)
class PurchaseOrderSnapshot:
    id: PurchaseOrderId
    ordered_quantity_by_item_code: dict[str, Decimal]
    po_number: str | None = None
    status: str | None = None
    supplier_id: str | None = None
    supplier_name: str | None = None
    supplier_company_name: str | None = None
    supplier_email: str | None = None
    supplier_contact_person: str | None = None
    warehouse_id: str | None = None
    warehouse_name: str | None = None
    expected_delivery_date: object | None = None
    lines: tuple[PurchaseOrderLineSnapshot, ...] = ()


@dataclass(frozen=True)
class AsnLineSnapshot:
    item_code: str
    shipped_quantity: Decimal
    material_name: str | None = None
    uom: str | None = None


@dataclass(frozen=True)
class AsnDocumentSnapshot:
    document_type: str
    file_name: str
    file_url: str | None = None


@dataclass(frozen=True)
class AsnSnapshot:
    id: str
    asn_number: str
    status: str
    po_id: str | None = None
    po_number: str | None = None
    supplier_id: str | None = None
    warehouse_id: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_contact: str | None = None
    expected_arrival_at: datetime | None = None
    shipment_date: datetime | None = None
    transporter: str | None = None
    number_of_packages: int | None = None
    package_type: str | None = None
    shipping_method: str | None = None
    lines: tuple[AsnLineSnapshot, ...] = ()
    documents: tuple[AsnDocumentSnapshot, ...] = ()


@dataclass(frozen=True)
class GateEntrySnapshot:
    id: str
    gate_entry_number: str
    status: str
    po_id: str | None = None
    po_number: str | None = None
    asn_id: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    assigned_dock_id: str | None = None
    created_at: datetime | None = None


@dataclass(frozen=True)
class GrnHeaderSnapshot:
    id: str
    status: str
    grn_number: str | None = None
    po_id: str | None = None
    po_number: str | None = None
    asn_id: str | None = None
    asn_number: str | None = None
    gate_entry_id: str | None = None
    gate_entry_number: str | None = None
    supplier_name: str | None = None
    supplier_company_name: str | None = None
    warehouse_id: str | None = None
    warehouse_name: str | None = None
    dock_number: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    invoice_number: str | None = None
    receipt_type: str = "PO_RECEIPT"
    receipt_date: datetime | None = None
    received_by: str | None = None


@dataclass(frozen=True)
class WarehouseDockSnapshot:
    id: str
    dock_number: str
    warehouse_id: str
    dock_type: str | None = None
    capacity: int | None = None
    status: str | None = None


@dataclass(frozen=True)
class GrnContextLineSnapshot:
    item_code: str
    material_name: str | None = None
    material_category: str | None = None
    uom: str | None = None
    ordered_quantity: Decimal | None = None
    received_quantity: Decimal = Decimal("0")
    good_quantity: Decimal = Decimal("0")
    damaged_quantity: Decimal = Decimal("0")
    rejected_quantity: Decimal = Decimal("0")
    quality_approved_quantity: Decimal = Decimal("0")
    balance_quantity: Decimal = Decimal("0")


@dataclass(frozen=True)
class GrnContextSnapshot:
    receipt_type: str
    po_id: str | None
    po_number: str | None
    supplier_name: str | None
    supplier_company_name: str | None
    supplier_email: str | None
    supplier_contact_person: str | None
    warehouse_id: str | None
    warehouse_name: str | None
    asn: AsnSnapshot | None
    gate_entry: GateEntrySnapshot | None
    existing_grn: GrnHeaderSnapshot | None
    dock_options: list[WarehouseDockSnapshot]
    lines: list[GrnContextLineSnapshot]


class GrnRepository(Protocol):
    async def find_purchase_order(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrderSnapshot]: ...

    async def save(self, grn: GoodsReceiptNote) -> None:
        """Persists the GRN and its raised domain events as outbox rows,
        in the same local database transaction."""
        ...

    async def find_by_id(self, grn_id: GrnId) -> Optional[GoodsReceiptNote]: ...
