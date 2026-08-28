"""
Application-layer repository port for Goods Receiving / GRN.

This module defines only:
- immutable snapshots returned by persistence/integration adapters
- the GrnRepository protocol used by receiving use cases

It contains no SQLAlchemy/FastAPI code.

The important integration path is:

    Purchase Order
        -> ASN
        -> Gate Entry
        -> Existing GRN
        -> Receiving Dock options

The concrete PostgreSQL queries belong in:
    infrastructure/persistence/repository_impl.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Protocol

from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.value_objects import GrnId, PurchaseOrderId


# ============================================================================
# PURCHASE ORDER SNAPSHOTS
# ============================================================================

@dataclass(frozen=True)
class PurchaseOrderLineSnapshot:
    item_code: str
    ordered_quantity: Decimal

    material_name: str | None = None
    material_category: str | None = None
    uom: str | None = None


@dataclass(frozen=True)
class PurchaseOrderSnapshot:
    """
    Read-only PO information required by Goods Receiving.

    The first two fields intentionally preserve compatibility with the
    original ConfirmGrnUseCase / repository implementation.
    """

    id: PurchaseOrderId
    ordered_quantity_by_item_code: dict[str, Decimal]

    po_number: str | None = None
    status: str | None = None

    supplier_id: str | None = None
    supplier_name: str | None = None
    supplier_company_name: str | None = None

    warehouse_id: str | None = None
    warehouse_name: str | None = None

    expected_delivery_date: date | None = None

    lines: tuple[PurchaseOrderLineSnapshot, ...] = field(default_factory=tuple)


# ============================================================================
# ASN SNAPSHOTS
# ============================================================================

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
    file_url: str


@dataclass(frozen=True)
class AsnSnapshot:
    """
    Advance Shipment Notice information consumed by receiving.

    Vehicle and driver details for normal PO receipts should come from this
    backend snapshot, not from arbitrary frontend values.
    """

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
    shipment_date: date | None = None

    transporter: str | None = None
    number_of_packages: int | None = None
    package_type: str | None = None
    shipping_method: str | None = None

    lines: tuple[AsnLineSnapshot, ...] = field(default_factory=tuple)
    documents: tuple[AsnDocumentSnapshot, ...] = field(default_factory=tuple)


# ============================================================================
# GATE ENTRY SNAPSHOT
# ============================================================================

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

    # This is the Gate/Dock-management assignment only.
    # It must NOT be automatically copied into grn.dock_number.
    assigned_dock_id: str | None = None

    created_at: datetime | None = None


# ============================================================================
# WAREHOUSE DOCK SNAPSHOT
# ============================================================================

@dataclass(frozen=True)
class WarehouseDockSnapshot:
    id: str
    dock_number: str
    warehouse_id: str

    dock_type: str | None = None
    capacity: int | None = None
    status: str | None = None


# ============================================================================
# EXISTING GRN HEADER SNAPSHOT
# ============================================================================

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

    receipt_type: str | None = None
    receipt_date: datetime | None = None
    received_by: str | None = None


# ============================================================================
# REPOSITORY PORT
# ============================================================================

class GrnRepository(Protocol):
    # ------------------------------------------------------------------
    # Legacy PO lookup used by the existing ConfirmGrnUseCase.
    # Keep this signature so the current API remains compatible.
    # ------------------------------------------------------------------

    async def find_purchase_order(
        self,
        po_id: PurchaseOrderId,
    ) -> Optional[PurchaseOrderSnapshot]:
        ...


    # ------------------------------------------------------------------
    # Rich PO / ASN / Gate lookups for the new GRN workflow.
    # ------------------------------------------------------------------

    async def find_purchase_order_by_number(
        self,
        po_number: str,
    ) -> Optional[PurchaseOrderSnapshot]:
        ...

    async def find_asn_by_reference(
        self,
        reference: str,
    ) -> Optional[AsnSnapshot]:
        """
        Find ASN by ASN UUID or ASN number.
        """
        ...

    async def find_latest_asn_for_po(
        self,
        *,
        po_id: str | None = None,
        po_number: str | None = None,
    ) -> Optional[AsnSnapshot]:
        """
        Resolve the current/latest ASN for a PO.

        This supports normal receiving where vehicle/driver/shipment details
        must be fetched from ASN.
        """
        ...

    async def find_latest_gate_entry_for_asn(
        self,
        asn_id: str,
    ) -> Optional[GateEntrySnapshot]:
        ...

    async def find_latest_gate_entry_for_po(
        self,
        po_number: str,
    ) -> Optional[GateEntrySnapshot]:
        ...

    async def find_grn_header_by_po(
        self,
        *,
        po_id: str | None = None,
        po_number: str | None = None,
    ) -> Optional[GrnHeaderSnapshot]:
        """
        Used to enforce/reuse the existing one-PO-one-GRN record.
        """
        ...

    async def list_docks_for_warehouse(
        self,
        warehouse_id: str,
    ) -> list[WarehouseDockSnapshot]:
        """
        Return dock choices for the receiving screen.

        The receiving user selects grn.dock_number manually.
        """
        ...


    # ------------------------------------------------------------------
    # Existing aggregate persistence.
    # ------------------------------------------------------------------

    async def save(self, grn: GoodsReceiptNote) -> None:
        """
        Persist the GRN aggregate and its outbox events in the caller's
        transaction.
        """
        ...

    async def find_by_id(
        self,
        grn_id: GrnId,
    ) -> Optional[GoodsReceiptNote]:
        ...
