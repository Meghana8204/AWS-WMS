"""
Application use cases for Goods Receiving / GRN.

This module keeps the original ConfirmGrnUseCase / GetGrnUseCase and adds
a context-loading use case for the integrated workflow:

    Purchase Order
        -> ASN
        -> Gate Entry
        -> Existing GRN
        -> Receiving Dock options

The application layer contains orchestration/business-flow logic only.
SQLAlchemy/FastAPI code stays in infrastructure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.common.domain.exceptions import NotFoundException
from app.modules.receiving.application.commands import (
    ConfirmGrnCommand,
    GetGrnContextQuery,
)
from app.modules.receiving.application.exceptions import (
    PurchaseOrderNotFoundException,
)
from app.modules.receiving.application.repository import (
    AsnSnapshot,
    GateEntrySnapshot,
    GrnHeaderSnapshot,
    GrnRepository,
    PurchaseOrderSnapshot,
    WarehouseDockSnapshot,
)
from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.receipt_line import ReceiptLine
from app.modules.receiving.domain.value_objects import (
    GrnId,
    PurchaseOrderId,
)


# ============================================================================
# CONTEXT RESULT OBJECTS
# ============================================================================

@dataclass(frozen=True)
class GrnContextLine:
    item_code: str
    ordered_quantity: Decimal

    material_name: str | None = None
    material_category: str | None = None
    uom: str | None = None

    # Quantity already physically received on the existing GRN.
    # Exact good/damaged/quality splits will come from richer line
    # persistence methods in the next write-workflow step.
    received_quantity: Decimal = Decimal("0")
    balance_quantity: Decimal = Decimal("0")


@dataclass(frozen=True)
class GrnContextResult:
    """
    Backend-produced receiving context.

    The frontend should display these values, not independently reconstruct
    PO / ASN / Gate relationships.
    """

    receipt_type: str = "PO_RECEIPT"

    po_id: str | None = None
    po_number: str | None = None

    supplier_id: str | None = None
    supplier_name: str | None = None
    supplier_company_name: str | None = None

    warehouse_id: str | None = None
    warehouse_name: str | None = None

    asn: AsnSnapshot | None = None
    gate_entry: GateEntrySnapshot | None = None
    existing_grn: GrnHeaderSnapshot | None = None

    dock_options: tuple[WarehouseDockSnapshot, ...] = field(
        default_factory=tuple
    )

    lines: tuple[GrnContextLine, ...] = field(default_factory=tuple)


# ============================================================================
# LEGACY CONFIRM GRN
# ============================================================================

class ConfirmGrnUseCase:
    """
    Backward-compatible use case used by the original receiving endpoint.

    Important:
    The database now enforces one PO -> one GRN. Therefore this use case
    checks for an existing GRN before inserting a new one.

    The new page-wise partial-receipt workflow should eventually use the
    dedicated update commands rather than repeatedly calling this legacy
    confirm endpoint.
    """

    def __init__(self, grn_repository: GrnRepository) -> None:
        self._grn_repository = grn_repository

    async def handle(self, command: ConfirmGrnCommand) -> GrnId:
        po_id = PurchaseOrderId.of(command.po_id)

        po = await self._grn_repository.find_purchase_order(po_id)

        if po is None:
            raise PurchaseOrderNotFoundException(command.po_id)

        # ------------------------------------------------------------
        # ONE PO -> ONE GRN
        # ------------------------------------------------------------
        # Do not create a second GRN if a GRN already exists for the PO.
        # This keeps the old endpoint idempotent while the richer partial
        # receiving update flow is implemented separately.
        # ------------------------------------------------------------

        existing = await self._grn_repository.find_grn_header_by_po(
            po_id=str(po.id.value),
            po_number=po.po_number,
        )

        if existing is not None:
            return GrnId.of(existing.id)

        # ------------------------------------------------------------
        # BUILD RECEIPT LINES FROM AUTHORITATIVE PO QUANTITIES
        # ------------------------------------------------------------

        lines = [
            ReceiptLine(
                item_code=line.item_code,
                received_quantity=line.quantity,
                ordered_quantity=po.ordered_quantity_by_item_code.get(
                    line.item_code
                ),
            )
            for line in command.lines
        ]

        grn = GoodsReceiptNote.confirm(po_id, lines)

        await self._grn_repository.save(grn)

        return grn.id


# ============================================================================
# GET GRN
# ============================================================================

class GetGrnUseCase:
    def __init__(self, grn_repository: GrnRepository) -> None:
        self._grn_repository = grn_repository

    async def handle(self, grn_id: GrnId) -> GoodsReceiptNote:
        grn = await self._grn_repository.find_by_id(grn_id)

        if grn is None:
            raise NotFoundException(f"GRN not found: {grn_id}")

        return grn


# ============================================================================
# LOAD PO -> ASN -> GATE ENTRY -> EXISTING GRN CONTEXT
# ============================================================================

class GetGrnContextUseCase:
    """
    Loads all server-side information required by Page 1 of Goods Receiving.

    Resolution order:

        1. Purchase Order
        2. Existing GRN for that PO
        3. Latest ASN for that PO
        4. Latest Gate Entry for that ASN
           - fallback: latest Gate Entry for PO number
        5. Warehouse receiving-dock choices
        6. PO material lines + cumulative received quantity

    Receiving Dock rule:
    The Gate Entry assigned dock is NOT copied into the GRN. The UI gets
    dock_options and the receiving user selects the GRN dock manually.
    """

    def __init__(self, grn_repository: GrnRepository) -> None:
        self._grn_repository = grn_repository

    async def handle(
        self,
        query: GetGrnContextQuery,
    ) -> GrnContextResult:

        # ------------------------------------------------------------
        # 1. RESOLVE PURCHASE ORDER
        # ------------------------------------------------------------

        po = await self._find_po(query)

        # ------------------------------------------------------------
        # 2. FIND EXISTING GRN
        # ------------------------------------------------------------

        existing_grn = (
            await self._grn_repository.find_grn_header_by_po(
                po_id=str(po.id.value),
                po_number=po.po_number,
            )
        )

        # ------------------------------------------------------------
        # 3. FIND LATEST ASN
        # ------------------------------------------------------------

        asn = await self._grn_repository.find_latest_asn_for_po(
            po_id=str(po.id.value),
            po_number=po.po_number,
        )

        # ------------------------------------------------------------
        # 4. FIND GATE ENTRY
        # ------------------------------------------------------------

        gate_entry: GateEntrySnapshot | None = None

        if asn is not None:
            gate_entry = (
                await self._grn_repository.find_latest_gate_entry_for_asn(
                    asn.id
                )
            )

        # Fallback for legacy/partially-linked Gate Entry rows.
        if gate_entry is None and po.po_number:
            gate_entry = (
                await self._grn_repository.find_latest_gate_entry_for_po(
                    po.po_number
                )
            )

        # ------------------------------------------------------------
        # 5. RESOLVE WAREHOUSE
        # ------------------------------------------------------------

        warehouse_id = (
            (existing_grn.warehouse_id if existing_grn else None)
            or (asn.warehouse_id if asn else None)
            or po.warehouse_id
        )

        warehouse_name = (
            (existing_grn.warehouse_name if existing_grn else None)
            or po.warehouse_name
        )

        # ------------------------------------------------------------
        # 6. LOAD RECEIVING DOCK OPTIONS
        # ------------------------------------------------------------

        dock_options: list[WarehouseDockSnapshot] = []

        if warehouse_id:
            dock_options = (
                await self._grn_repository.list_docks_for_warehouse(
                    warehouse_id
                )
            )

        # ------------------------------------------------------------
        # 7. CUMULATIVE RECEIVED QUANTITIES
        # ------------------------------------------------------------

        received_by_item: dict[str, Decimal] = {}

        if existing_grn is not None:
            existing_aggregate = await self._grn_repository.find_by_id(
                GrnId.of(existing_grn.id)
            )

            if existing_aggregate is not None:
                for line in existing_aggregate.lines:
                    received_by_item[line.item_code] = (
                        received_by_item.get(
                            line.item_code,
                            Decimal("0"),
                        )
                        + Decimal(line.received_quantity)
                    )

        context_lines: list[GrnContextLine] = []

        for line in po.lines:
            ordered = Decimal(line.ordered_quantity)
            received = received_by_item.get(
                line.item_code,
                Decimal("0"),
            )

            balance = max(
                ordered - received,
                Decimal("0"),
            )

            context_lines.append(
                GrnContextLine(
                    item_code=line.item_code,
                    ordered_quantity=ordered,
                    material_name=line.material_name,
                    material_category=line.material_category,
                    uom=line.uom,
                    received_quantity=received,
                    balance_quantity=balance,
                )
            )

        # ------------------------------------------------------------
        # 8. BUILD RESULT
        # ------------------------------------------------------------

        return GrnContextResult(
            receipt_type=(
                existing_grn.receipt_type
                if existing_grn and existing_grn.receipt_type
                else "PO_RECEIPT"
            ),
            po_id=str(po.id.value),
            po_number=po.po_number,
            supplier_id=po.supplier_id,
            supplier_name=(
                (existing_grn.supplier_name if existing_grn else None)
                or po.supplier_name
            ),
            supplier_company_name=(
                (
                    existing_grn.supplier_company_name
                    if existing_grn
                    else None
                )
                or po.supplier_company_name
            ),
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            asn=asn,
            gate_entry=gate_entry,
            existing_grn=existing_grn,
            dock_options=tuple(dock_options),
            lines=tuple(context_lines),
        )

    async def _find_po(
        self,
        query: GetGrnContextQuery,
    ) -> PurchaseOrderSnapshot:
        """
        Resolve a PO from either po_id or po_number.

        po_id is tried first when both are provided.
        """

        po = None
        if query.po_id:
            po_id = PurchaseOrderId.of(query.po_id)
            po = await self._grn_repository.find_purchase_order(po_id)

        if po is None and query.po_number:
            po = await self._grn_repository.find_purchase_order_by_number(query.po_number)

        if po is None:
            reference = query.po_id or query.po_number or "<missing>"
            raise PurchaseOrderNotFoundException(reference)

        if not po.lines or len(po.lines) == 0:
            raise ValueError(f"No items found for PO {po.po_number}")

        return po
