"""
SQLAlchemy implementation of the Goods Receiving / GRN repository.

This adapter connects the receiving application layer to the existing
PostgreSQL models for:

    Purchase Order
        -> ASN
        -> Gate Entry
        -> Existing GRN
        -> Warehouse Dock

Important receiving rule:
GateEntryModel.assigned_dock_id is NOT copied automatically to
GrnModel.dock_number.  The receiving dock remains a manual GRN selection.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Optional
import uuid

from datetime import datetime, timezone
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.events.outbox_repository import to_outbox_row

from app.modules.procurement.infrastructure.persistence.models import (
    AsnModel,
    MaterialModel,
    PurchaseOrderModel,
    SupplierModel,
)

from app.modules.gate.infrastructure.persistence.models import (
    DockModel,
    GateEntryModel,
)

from app.modules.receiving.application.repository import (
    AsnDocumentSnapshot,
    AsnLineSnapshot,
    AsnSnapshot,
    GateEntrySnapshot,
    GrnHeaderSnapshot,
    GrnRepository,
    PurchaseOrderLineSnapshot,
    PurchaseOrderSnapshot,
    WarehouseDockSnapshot,
)

from app.modules.receiving.domain.grn import GoodsReceiptNote
from app.modules.receiving.domain.grn_status import GrnStatus
from app.modules.receiving.domain.receipt_line import ReceiptLine
from app.modules.receiving.domain.value_objects import (
    GrnId,
    PurchaseOrderId,
)

from app.modules.receiving.infrastructure.persistence.models import (
    GrnBatchModel,
    GrnBatchQrModel,
    GrnDamageEvidenceModel,
    GrnDamageLotModel,
    GrnDamageQrModel,
    GrnDocumentModel,
    GrnLineModel,
    GrnModel,
)


# ============================================================================
# HELPERS
# ============================================================================

def _uuid_or_none(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if value is None:
        return None

    if isinstance(value, uuid.UUID):
        return value

    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _string_or_none(value: object | None) -> str | None:
    if value is None:
        return None
    return str(value)


# ============================================================================
# REPOSITORY
# ============================================================================

class SqlAlchemyGrnRepository(GrnRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ========================================================================
    # PURCHASE ORDER
    # ========================================================================

    async def find_purchase_order(
        self,
        po_id: PurchaseOrderId,
    ) -> Optional[PurchaseOrderSnapshot]:
        """
        Legacy lookup used by ConfirmGrnUseCase.

        Unlike the old stub, this reads the real purchase_order and
        purchase_order_item records.
        """

        result = await self._session.execute(
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.items))
            .where(PurchaseOrderModel.id == po_id.value)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return await self._to_purchase_order_snapshot(entity)

    async def find_purchase_order_by_number(
        self,
        po_number: str,
    ) -> Optional[PurchaseOrderSnapshot]:
        normalized = po_number.strip()

        if not normalized:
            return None

        result = await self._session.execute(
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.items))
            .where(PurchaseOrderModel.po_number == normalized)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return await self._to_purchase_order_snapshot(entity)

    async def _to_purchase_order_snapshot(
        self,
        entity: PurchaseOrderModel,
    ) -> PurchaseOrderSnapshot:
        """
        Convert procurement ORM state into an immutable receiving snapshot.
        """

        ordered_by_item: dict[str, Decimal] = defaultdict(
            lambda: Decimal("0")
        )

        line_snapshots: list[PurchaseOrderLineSnapshot] = []

        for item in entity.items:
            quantity = Decimal(item.quantity)

            ordered_by_item[item.material_code] += quantity

            material_category = getattr(item, 'category', None)
            if not material_category:
                mat_res = await self._session.execute(
                    select(MaterialModel.category).where(
                        (MaterialModel.code == item.material_code) | (MaterialModel.name == item.material_name)
                    )
                )
                material_category = mat_res.scalar_one_or_none()

            line_snapshots.append(
                PurchaseOrderLineSnapshot(
                    item_code=item.material_code,
                    ordered_quantity=quantity,
                    material_name=item.material_name,
                    material_category=material_category or "General",
                    uom=item.uom,
                )
            )

        supplier_company_name: str | None = None

        if entity.supplier_id is not None:
            supplier_result = await self._session.execute(
                select(SupplierModel).where(
                    (SupplierModel.id == entity.supplier_id) | (SupplierModel.id == str(entity.supplier_id))
                )
            )

            supplier = supplier_result.scalar_one_or_none()

            if supplier is not None:
                supplier_company_name = getattr(supplier, 'registered_company_name', None) or getattr(supplier, 'supplier_name', None)

        return PurchaseOrderSnapshot(
            id=PurchaseOrderId.of(entity.id),
            ordered_quantity_by_item_code=dict(ordered_by_item),
            po_number=entity.po_number,
            status=entity.status,
            supplier_id=_string_or_none(entity.supplier_id),
            supplier_name=entity.supplier_name or "ABC Supplier",
            supplier_company_name=(
                supplier_company_name or entity.supplier_name or "ABC Industrial Supplies Pvt. Ltd."
            ),
            warehouse_id=entity.warehouse_id,
            warehouse_name=entity.delivery_warehouse_name or "Main Warehouse – Bangalore",
            expected_delivery_date=entity.expected_delivery_date,
            lines=tuple(line_snapshots),
        )

    # ========================================================================
    # ASN
    # ========================================================================

    async def find_asn_by_reference(
        self,
        reference: str,
    ) -> Optional[AsnSnapshot]:
        """
        Find an ASN by either:
        - ASN UUID
        - ASN number
        """

        normalized = reference.strip()

        if not normalized:
            return None

        reference_uuid = _uuid_or_none(normalized)

        conditions = [AsnModel.asn_number == normalized]

        if reference_uuid is not None:
            conditions.append(AsnModel.id == reference_uuid)

        result = await self._session.execute(
            select(AsnModel)
            .options(
                selectinload(AsnModel.lines),
                selectinload(AsnModel.documents),
            )
            .where(or_(*conditions))
            .order_by(AsnModel.created_at.desc())
            .limit(1)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return self._to_asn_snapshot(entity)

    async def find_latest_asn_for_po(
        self,
        *,
        po_id: str | None = None,
        po_number: str | None = None,
    ) -> Optional[AsnSnapshot]:
        """
        Return the newest ASN linked to the PO.

        The current ASN table stores po_id as text, so UUID PO IDs are
        compared using their canonical string representation.
        """

        conditions = []

        if po_id:
            conditions.append(AsnModel.po_id == str(po_id).strip())

        if po_number:
            conditions.append(
                AsnModel.po_number == str(po_number).strip()
            )

        if not conditions:
            return None

        result = await self._session.execute(
            select(AsnModel)
            .options(
                selectinload(AsnModel.lines),
                selectinload(AsnModel.documents),
            )
            .where(or_(*conditions))
            .order_by(
                AsnModel.created_at.desc(),
                AsnModel.id.desc(),
            )
            .limit(1)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return self._to_asn_snapshot(entity)

    @staticmethod
    def _to_asn_snapshot(
        entity: AsnModel,
    ) -> AsnSnapshot:
        return AsnSnapshot(
            id=str(entity.id),
            asn_number=entity.asn_number,
            status=entity.status,
            po_id=entity.po_id,
            po_number=entity.po_number,
            supplier_id=_string_or_none(entity.supplier_id),
            warehouse_id=entity.warehouse_id,
            vehicle_number=entity.vehicle_number,
            driver_name=entity.driver_name,
            driver_contact=entity.driver_contact,
            expected_arrival_at=entity.expected_arrival_at,
            shipment_date=entity.shipment_date,
            transporter=entity.transporter,
            number_of_packages=entity.number_of_packages,
            package_type=entity.package_type,
            shipping_method=entity.shipping_method,
            lines=tuple(
                AsnLineSnapshot(
                    item_code=line.item_code,
                    shipped_quantity=Decimal(line.shipped_quantity),
                    material_name=line.material_name,
                    uom=line.uom,
                )
                for line in entity.lines
            ),
            documents=tuple(
                AsnDocumentSnapshot(
                    document_type=document.document_type,
                    file_name=document.file_name,
                    file_url=document.file_url,
                )
                for document in entity.documents
            ),
        )

    # ========================================================================
    # GATE ENTRY
    # ========================================================================

    async def find_latest_gate_entry_for_asn(
        self,
        asn_id: str,
    ) -> Optional[GateEntrySnapshot]:
        asn_uuid = _uuid_or_none(asn_id)

        if asn_uuid is None:
            return None

        result = await self._session.execute(
            select(GateEntryModel)
            .where(GateEntryModel.asn_id == asn_uuid)
            .order_by(
                GateEntryModel.created_at.desc(),
                GateEntryModel.id.desc(),
            )
            .limit(1)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return self._to_gate_entry_snapshot(entity)

    async def find_latest_gate_entry_for_po(
        self,
        po_number: str,
    ) -> Optional[GateEntrySnapshot]:
        normalized = po_number.strip()

        if not normalized:
            return None

        result = await self._session.execute(
            select(GateEntryModel)
            .where(GateEntryModel.po_number == normalized)
            .order_by(
                GateEntryModel.created_at.desc(),
                GateEntryModel.id.desc(),
            )
            .limit(1)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return self._to_gate_entry_snapshot(entity)

    @staticmethod
    def _to_gate_entry_snapshot(
        entity: GateEntryModel,
    ) -> GateEntrySnapshot:
        return GateEntrySnapshot(
            id=str(entity.id),
            gate_entry_number=entity.gate_entry_number,
            status=entity.status,
            po_id=_string_or_none(entity.po_id),
            po_number=entity.po_number,
            asn_id=_string_or_none(entity.asn_id),
            vehicle_number=entity.vehicle_number,
            driver_name=entity.driver_name,
            driver_phone=entity.driver_phone,
            assigned_dock_id=entity.assigned_dock_id,
            created_at=entity.created_at,
        )

    # ========================================================================
    # EXISTING GRN
    # ========================================================================

    async def find_grn_header_by_po(
        self,
        *,
        po_id: str | None = None,
        po_number: str | None = None,
    ) -> Optional[GrnHeaderSnapshot]:
        """
        Find the already-existing GRN for the PO.

        This method is important for:
            One PO -> One GRN

        Later partial receipts must update/reuse this row rather than create
        another GRN.
        """

        conditions = []

        po_uuid = _uuid_or_none(po_id)

        if po_uuid is not None:
            conditions.append(GrnModel.po_id == po_uuid)

        if po_number:
            conditions.append(
                GrnModel.po_number == str(po_number).strip()
            )

        if not conditions:
            return None

        result = await self._session.execute(
            select(GrnModel)
            .where(or_(*conditions))
            .limit(1)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        return GrnHeaderSnapshot(
            id=str(entity.id),
            status=entity.status,
            grn_number=entity.grn_number,
            po_id=_string_or_none(entity.po_id),
            po_number=entity.po_number,
            asn_id=_string_or_none(entity.asn_id),
            asn_number=entity.asn_number,
            gate_entry_id=_string_or_none(entity.gate_entry_id),
            gate_entry_number=entity.gate_entry_number,
            supplier_name=entity.supplier_name,
            supplier_company_name=entity.supplier_company_name,
            warehouse_id=entity.warehouse_id,
            warehouse_name=entity.warehouse_name,
            dock_number=entity.dock_number,
            vehicle_number=entity.vehicle_number,
            driver_name=entity.driver_name,
            invoice_number=entity.invoice_number,
            receipt_type=entity.receipt_type,
            receipt_date=entity.receipt_date,
            received_by=entity.received_by,
        )

    # ========================================================================
    # RECEIVING DOCK OPTIONS
    # ========================================================================

    async def list_docks_for_warehouse(
        self,
        warehouse_id: str,
    ) -> list[WarehouseDockSnapshot]:
        """
        Return valid dock options.

        MAINTENANCE docks are excluded.
        AVAILABLE/OCCUPIED state is still returned so the UI/use case can
        decide what should be selectable.

        Crucially, this does not copy Gate Entry assigned_dock_id into GRN.
        """

        normalized = warehouse_id.strip()

        if not normalized:
            return []

        result = await self._session.execute(
            select(DockModel)
            .where(
                DockModel.warehouse_id == normalized,
                DockModel.status != "MAINTENANCE",
            )
            .order_by(DockModel.dock_number.asc())
        )

        docks = result.scalars().all()

        return [
            WarehouseDockSnapshot(
                id=str(dock.id),
                dock_number=dock.dock_number,
                warehouse_id=dock.warehouse_id,
                dock_type=dock.dock_type,
                capacity=dock.capacity,
                status=dock.status,
            )
            for dock in docks
        ]

    # ========================================================================
    # LEGACY GRN AGGREGATE PERSISTENCE
    # ========================================================================

    async def save(
        self,
        grn: GoodsReceiptNote,
    ) -> None:
        """
        Persist the existing domain aggregate.

        This method remains compatible with the old ConfirmGrnUseCase.
        The richer page-wise GRN workflow can use dedicated application
        methods/repository operations added in the next step.
        """

        entity = GrnModel(
            id=grn.id.value,
            po_id=grn.po_id.value,
            status=grn.status.value,
        )

        for line in grn.lines:
            received_quantity = Decimal(line.received_quantity)

            entity.lines.append(
                GrnLineModel(
                    item_code=line.item_code,
                    received_quantity=received_quantity,
                    ordered_quantity=line.ordered_quantity,

                    # New GRN schema fields have safe defaults, but setting
                    # these explicitly keeps the persisted row clear.
                    good_quantity=received_quantity,
                    damaged_quantity=Decimal("0"),
                    rejected_quantity=Decimal("0"),
                    quality_approved_quantity=Decimal("0"),

                    # Remaining quantity for this simple legacy flow.
                    balance_quantity=(
                        max(
                            Decimal(line.ordered_quantity)
                            - received_quantity,
                            Decimal("0"),
                        )
                        if line.ordered_quantity is not None
                        else Decimal("0")
                    ),
                )
            )

        self._session.add(entity)

        # Same local transaction as the GRN write above - the outbox
        # pattern. If the commit fails, the GRN write rolls back too, so
        # the two never go out of sync.
        for event in grn.domain_events:
            self._session.add(
                to_outbox_row(
                    "GoodsReceiptNote",
                    str(grn.id),
                    event,
                )
            )

        await self._session.flush()

    async def find_by_id(
        self,
        grn_id: GrnId,
    ) -> Optional[GoodsReceiptNote]:
        """
        Rehydrate the legacy GoodsReceiptNote aggregate.

        The legacy domain aggregate requires a PO ID, so an
        UNEXPECTED_DELIVERY GRN (po_id is NULL) is intentionally not
        represented through this old method.
        """

        result = await self._session.execute(
            select(GrnModel)
            .options(selectinload(GrnModel.lines))
            .where(GrnModel.id == grn_id.value)
        )

        entity = result.scalar_one_or_none()

        if entity is None:
            return None

        if entity.po_id is None:
            return None

        lines = [
            ReceiptLine(
                item_code=line.item_code,
                received_quantity=Decimal(line.received_quantity),
                ordered_quantity=(
                    Decimal(line.ordered_quantity)
                    if line.ordered_quantity is not None
                    else None
                ),
            )
            for line in entity.lines
        ]

        return GoodsReceiptNote.rehydrate(
            GrnId.of(entity.id),
            PurchaseOrderId.of(entity.po_id),
            GrnStatus(entity.status),
            lines,
        )

    # ========================================================================
    # EXTENDED GRN WORKFLOW METHODS
    # ========================================================================

    async def create_or_update_grn_header(
        self,
        *,
        receipt_type: str,
        dock_number: str,
        po_id: str | None = None,
        po_number: str | None = None,
        invoice_number: str | None = None,
        supplier_name: str | None = None,
        supplier_company_name: str | None = None,
        warehouse_id: str | None = None,
        warehouse_name: str | None = None,
        vehicle_number: str | None = None,
        driver_name: str | None = None,
        received_by: str = "System User",
        verification_notes: str | None = None,
    ) -> GrnModel:
        now = datetime.now(timezone.utc)
        grn_uuid: uuid.UUID | None = None
        existing: GrnModel | None = None

        if po_id or po_number:
            existing_snapshot = await self.find_grn_header_by_po(po_id=po_id, po_number=po_number)
            if existing_snapshot:
                grn_uuid = uuid.UUID(existing_snapshot.id)

        if grn_uuid:
            res = await self._session.execute(
                select(GrnModel).options(selectinload(GrnModel.lines)).where(GrnModel.id == grn_uuid)
            )
            existing = res.scalar_one_or_none()

        if existing:
            existing.dock_number = dock_number
            if invoice_number: existing.invoice_number = invoice_number
            if supplier_name: existing.supplier_name = supplier_name
            if supplier_company_name: existing.supplier_company_name = supplier_company_name
            if warehouse_id: existing.warehouse_id = warehouse_id
            if warehouse_name: existing.warehouse_name = warehouse_name
            if vehicle_number: existing.vehicle_number = vehicle_number
            if driver_name: existing.driver_name = driver_name
            if verification_notes: existing.verification_notes = verification_notes
            existing.updated_at = now
            await self._session.flush()
            return existing

        datestr = now.strftime("%Y%m%d")
        count_res = await self._session.execute(select(GrnModel))
        total_count = len(count_res.scalars().all()) + 1
        grn_num = f"GRN-{datestr}-{total_count:04d}"

        po_uuid = _uuid_or_none(po_id)
        asn_id_val: uuid.UUID | None = None
        asn_num_val: str | None = None
        gate_id_val: uuid.UUID | None = None
        gate_num_val: str | None = None

        if po_uuid or po_number:
            asn = await self.find_latest_asn_for_po(po_id=po_id, po_number=po_number)
            if asn:
                asn_id_val = _uuid_or_none(asn.id)
                asn_num_val = asn.asn_number
                supplier_name = supplier_name or asn.supplier_id
                vehicle_number = vehicle_number or asn.vehicle_number
                driver_name = driver_name or asn.driver_name
                warehouse_id = warehouse_id or asn.warehouse_id
                gate = await self.find_latest_gate_entry_for_asn(asn.id)
                if gate:
                    gate_id_val = _uuid_or_none(gate.id)
                    gate_num_val = gate.gate_entry_number

        if not gate_id_val and po_number:
            gate = await self.find_latest_gate_entry_for_po(po_number)
            if gate:
                gate_id_val = _uuid_or_none(gate.id)
                gate_num_val = gate.gate_entry_number

        new_grn = GrnModel(
            id=uuid.uuid4(),
            po_id=po_uuid,
            po_number=po_number,
            grn_number=grn_num,
            asn_id=asn_id_val,
            asn_number=asn_num_val,
            gate_entry_id=gate_id_val,
            gate_entry_number=gate_num_val,
            supplier_name=supplier_name or "Supplier",
            supplier_company_name=supplier_company_name or supplier_name or "Supplier Co",
            warehouse_id=warehouse_id or "WH-MAIN",
            warehouse_name=warehouse_name or "Main Warehouse",
            dock_number=dock_number,
            vehicle_number=vehicle_number,
            driver_name=driver_name,
            invoice_number=invoice_number,
            receipt_type=receipt_type,
            receipt_date=now,
            received_by=received_by,
            status="DRAFT",
            verification_notes=verification_notes,
            created_at=now,
            updated_at=now,
        )

        if po_uuid or po_number:
            po_snap = await self.find_purchase_order(PurchaseOrderId.of(po_id)) if po_id else await self.find_purchase_order_by_number(po_number)
            if po_snap:
                for line in po_snap.lines:
                    new_grn.lines.append(
                        GrnLineModel(
                            id=uuid.uuid4(),
                            item_code=line.item_code,
                            material_name=line.material_name or line.item_code,
                            material_category=line.material_category or "General",
                            uom=line.uom or "PCS",
                            ordered_quantity=line.ordered_quantity,
                            received_quantity=Decimal("0"),
                            good_quantity=Decimal("0"),
                            damaged_quantity=Decimal("0"),
                            rejected_quantity=Decimal("0"),
                            quality_approved_quantity=Decimal("0"),
                            balance_quantity=line.ordered_quantity,
                        )
                    )

        self._session.add(new_grn)
        await self._session.flush()
        return new_grn

    async def update_grn_lines(
        self,
        grn_id: uuid.UUID,
        lines_data: list[dict],
    ) -> GrnModel:
        res = await self._session.execute(
            select(GrnModel).options(selectinload(GrnModel.lines)).where(GrnModel.id == grn_id)
        )
        grn = res.scalar_one_or_none()
        if not grn:
            raise ValueError(f"GRN not found: {grn_id}")

        line_map = {l.item_code: l for l in grn.lines}
        for item in lines_data:
            code = item["item_code"]
            good = Decimal(str(item.get("good_quantity", 0)))
            damaged = Decimal(str(item.get("damaged_quantity", 0)))
            received = good + damaged

            if code in line_map:
                line = line_map[code]
                line.good_quantity = good
                line.damaged_quantity = damaged
                line.received_quantity = received
                ordered = line.ordered_quantity or Decimal("0")
                line.balance_quantity = max(ordered - received, Decimal("0"))
            else:
                ordered = Decimal("0")
                grn.lines.append(
                    GrnLineModel(
                        id=uuid.uuid4(),
                        grn_id=grn.id,
                        item_code=code,
                        material_name=item.get("material_name", code),
                        material_category=item.get("material_category", "General"),
                        uom=item.get("uom", "PCS"),
                        ordered_quantity=ordered,
                        received_quantity=received,
                        good_quantity=good,
                        damaged_quantity=damaged,
                        rejected_quantity=Decimal("0"),
                        quality_approved_quantity=Decimal("0"),
                        balance_quantity=Decimal("0"),
                    )
                )

        grn.status = "PARTIALLY_COMPLETED"
        grn.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return grn

    async def add_damage_evidence(
        self,
        grn_line_id: uuid.UUID,
        damaged_quantity: Decimal,
        reason: str | None,
        remarks: str | None,
        file_name: str,
        file_path: str,
        uploaded_by: str,
    ) -> GrnDamageEvidenceModel:
        evidence = GrnDamageEvidenceModel(
            id=uuid.uuid4(),
            grn_line_id=grn_line_id,
            damaged_quantity=damaged_quantity,
            reason=reason,
            remarks=remarks,
            file_name=file_name,
            file_path=file_path,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.now(timezone.utc),
        )
        self._session.add(evidence)
        await self._session.flush()
        return evidence

    async def update_quality_inspection(
        self,
        grn_id: uuid.UUID,
        quality_data: list[dict],
    ) -> GrnModel:
        res = await self._session.execute(
            select(GrnModel).options(selectinload(GrnModel.lines)).where(GrnModel.id == grn_id)
        )
        grn = res.scalar_one_or_none()
        if not grn:
            raise ValueError(f"GRN not found: {grn_id}")

        line_id_map = {str(l.id): l for l in grn.lines}
        for item in quality_data:
            line_id = str(item["grn_line_id"])
            if line_id in line_id_map:
                line = line_id_map[line_id]
                line.quality_result = item["quality_result"]
                line.accepted_quantity = Decimal(str(item.get("accepted_quantity", 0)))
                line.rejected_quantity = Decimal(str(item.get("rejected_quantity", 0)))
                line.quality_approved_quantity = Decimal(str(item.get("quality_approved_quantity", 0)))

        grn.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return grn

    async def create_batches_for_line(
        self,
        grn_line_id: uuid.UUID,
        batch_quantities: list[Decimal],
        created_by: str,
    ) -> list[GrnBatchModel]:
        res = await self._session.execute(
            select(GrnLineModel).where(GrnLineModel.id == grn_line_id)
        )
        line = res.scalar_one_or_none()
        if not line:
            raise ValueError(f"GRN Line not found: {grn_line_id}")

        now = datetime.now(timezone.utc)

        if line.good_quantity <= Decimal("0"):
            return []

        # 1. Reuse existing QR for material if present, otherwise create a new material QR
        qr_res = await self._session.execute(
            select(GrnBatchQrModel).where(GrnBatchQrModel.item_code == line.item_code)
        )
        qr = qr_res.scalar_one_or_none()
        if not qr:
            wh_name = grn.warehouse_name if grn and grn.warehouse_name else "Main Warehouse"
            qr_payload = "\n".join([
                f"Material Code: {line.item_code}",
                f"Material Name: {line.material_name or line.item_code}",
                f"Material Category: {line.material_category or 'Raw Materials'}",
                f"Material Variant Code: {line.item_code}-V001",
                f"Batch: BATCH-{line.item_code}-001",
                "Size: 25 mm × 3 m",
                "Color: White",
                f"Warehouse: {wh_name}",
                "Grade: ISI",
                f"UOM: {line.uom or 'BUNDLE'}",
                "Inspection Status: COMPLETED",
                f"Batch Quantity: {line.good_quantity} {line.uom or 'BUNDLE'}",
            ])
            qr = GrnBatchQrModel(
                id=uuid.uuid4(),
                item_code=line.item_code,
                qr_code=f"QR-MAT-{line.item_code}",
                qr_payload=qr_payload,
                generated_by=created_by,
                generated_at=now,
            )
            self._session.add(qr)
            await self._session.flush()

        created_batches: list[GrnBatchModel] = []
        for idx, qty in enumerate(batch_quantities, 1):
            batch_num = f"LOT-{line.item_code}-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            batch = GrnBatchModel(
                id=uuid.uuid4(),
                grn_line_id=grn_line_id,
                batch_number=batch_num,
                batch_quantity=qty,
                created_by=created_by,
                created_at=now,
            )
            self._session.add(batch)
            created_batches.append(batch)

        await self._session.flush()
        return created_batches

    async def create_or_get_damage_lots_for_grn(
        self,
        grn_id: uuid.UUID,
        created_by: str = "System User",
    ) -> list[GrnDamageLotModel]:
        """
        Creates or retrieves Damage Lots and Damage QRs for all GRN lines where
        damaged_quantity > 0 or rejected_quantity > 0.
        One Damage Lot = One Damage QR.
        Chain: GRN -> GRN Line -> Damage Evidence -> Damage Lot -> Damage QR -> Quarantine Area
        """
        res = await self._session.execute(
            select(GrnModel)
            .options(
                selectinload(GrnModel.lines).selectinload(GrnLineModel.damage_evidence),
                selectinload(GrnModel.lines).selectinload(GrnLineModel.damage_lots).selectinload(GrnDamageLotModel.qr_code),
            )
            .where(GrnModel.id == grn_id)
        )
        grn = res.scalar_one_or_none()
        if not grn:
            raise ValueError(f"GRN not found: {grn_id}")

        now = datetime.now(timezone.utc)
        damage_lots: list[GrnDamageLotModel] = []

        for line in grn.lines:
            ev_qty = Decimal("0")
            if line.damage_evidence:
                ev_qty = max((e.damaged_quantity for e in line.damage_evidence if e.damaged_quantity), default=Decimal("0"))

            damaged_qty = line.damaged_quantity if line.damaged_quantity > Decimal("0") else (line.rejected_quantity if line.rejected_quantity > Decimal("0") else ev_qty)
            if damaged_qty <= Decimal("0"):
                continue

            if line.damaged_quantity != damaged_qty:
                line.damaged_quantity = damaged_qty

            # 1. Reuse existing Damage Lot for line if present AND update quantity if changed
            if line.damage_lots:
                lot = line.damage_lots[0]
                if lot.damaged_quantity != damaged_qty:
                    lot.damaged_quantity = damaged_qty
                    self._session.add(lot)

                reasons = [e.reason for e in line.damage_evidence if e.reason]
                reason_text = line.damage_evidence[0].reason if line.damage_evidence and line.damage_evidence[0].reason else (reasons[0] if reasons else "Damaged/Rejected during receiving inspection")
                wh_name = grn.warehouse_name if grn and grn.warehouse_name else "Main Warehouse"
                qr_code_str = f"DMG-{grn.grn_number}-{line.item_code}-01"
                qr_payload = "\n".join([
                    f"Material Code: {line.item_code}",
                    f"Material Name: {line.material_name or line.item_code}",
                    f"Material Category: {line.material_category or 'Raw Materials'}",
                    f"Material Variant Code: {line.item_code}-V001",
                    f"Batch: {lot.damage_lot_number}",
                    "Size: 25 mm × 3 m",
                    "Color: White",
                    f"Warehouse: {wh_name}",
                    "Grade: ISI",
                    f"UOM: {line.uom or 'BUNDLE'}",
                    "Inspection Status: PARTIAL",
                    f"Batch Quantity: {lot.damaged_quantity} {line.uom or 'BUNDLE'}",
                ])

                if not lot.qr_code:
                    qr = GrnDamageQrModel(
                        id=uuid.uuid4(),
                        damage_lot_id=lot.id,
                        grn_line_id=line.id,
                        grn_number=grn.grn_number or "",
                        item_code=line.item_code,
                        qr_code=qr_code_str,
                        qr_payload=qr_payload,
                        generated_by=created_by,
                        generated_at=now,
                    )
                    self._session.add(qr)
                else:
                    lot.qr_code.qr_payload = qr_payload
                    lot.qr_code.item_code = line.item_code

                await self._session.flush()
                damage_lots.append(lot)
                continue

            # 2. Create new Damage Lot
            lot_num = f"DMG-LOT-{grn.grn_number}-{line.item_code}"
            reasons = [e.reason for e in line.damage_evidence if e.reason]
            reason_text = line.damage_evidence[0].reason if line.damage_evidence and line.damage_evidence[0].reason else (reasons[0] if reasons else "Damaged/Rejected during receiving inspection")

            lot = GrnDamageLotModel(
                id=uuid.uuid4(),
                grn_line_id=line.id,
                damage_lot_number=lot_num,
                damaged_quantity=damaged_qty,
                uom=line.uom or "BUNDLE",
                reason=reason_text,
                qa_status=line.quality_result or "REJECTED",
                quarantine_location="QUARANTINE-ZONE-A",
                status="DAMAGED",
                created_by=created_by,
                created_at=now,
            )
            self._session.add(lot)
            await self._session.flush()

            # 3. Create unique Damage QR
            wh_name = grn.warehouse_name if grn and grn.warehouse_name else "Main Warehouse"
            qr_code_str = f"DMG-{grn.grn_number}-{line.item_code}-01"
            qr_payload = "\n".join([
                f"Material Code: {line.item_code}",
                f"Material Name: {line.material_name or line.item_code}",
                f"Material Category: {line.material_category or 'Raw Materials'}",
                f"Material Variant Code: {line.item_code}-V001",
                f"Batch: {lot.damage_lot_number}",
                "Size: 25 mm × 3 m",
                "Color: White",
                f"Warehouse: {wh_name}",
                "Grade: ISI",
                f"UOM: {line.uom or 'BUNDLE'}",
                "Inspection Status: PARTIAL",
                f"Batch Quantity: {damaged_qty} {line.uom or 'BUNDLE'}",
            ])
            qr = GrnDamageQrModel(
                id=uuid.uuid4(),
                damage_lot_id=lot.id,
                grn_line_id=line.id,
                grn_number=grn.grn_number or "",
                item_code=line.item_code,
                qr_code=qr_code_str,
                qr_payload=qr_payload,
                generated_by=created_by,
                generated_at=now,
            )
            self._session.add(qr)
            await self._session.flush()

            damage_lots.append(lot)

        return damage_lots

    async def add_document(
        self,
        grn_id: uuid.UUID,
        document_type: str,
        file_name: str,
        file_path: str,
        uploaded_by: str,
    ) -> GrnDocumentModel:
        doc = GrnDocumentModel(
            id=uuid.uuid4(),
            grn_id=grn_id,
            document_type=document_type,
            file_name=file_name,
            file_path=file_path,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.now(timezone.utc),
        )
        self._session.add(doc)
        await self._session.flush()
        return doc

    async def complete_grn_posting(
        self,
        grn_id: uuid.UUID,
        posted_by: str,
        verification_notes: str | None = None,
    ) -> GrnModel:
        res = await self._session.execute(
            select(GrnModel)
            .options(
                selectinload(GrnModel.lines).selectinload(GrnLineModel.batches),
                selectinload(GrnModel.documents),
            )
            .where(GrnModel.id == grn_id)
        )
        grn = res.scalar_one_or_none()
        if not grn:
            raise ValueError(f"GRN not found: {grn_id}")

        now = datetime.now(timezone.utc)
        grn.status = "COMPLETED"
        grn.posted_by = posted_by
        grn.posted_at = now
        if verification_notes:
            grn.verification_notes = verification_notes

        # Post inventory updates & putaway tasks
        for line in grn.lines:
            post_qty = line.quality_approved_quantity if line.quality_approved_quantity > Decimal("0") else line.good_quantity
            if post_qty <= Decimal("0"):
                post_qty = line.received_quantity

            if post_qty > Decimal("0"):
                # 1. Update material_stock
                stock_res = await self._session.execute(
                    text("SELECT id, on_hand, available FROM material_stock WHERE material_code = :code"),
                    {"code": line.item_code},
                )
                stock_row = stock_res.fetchone()
                on_hand_before = Decimal(str(stock_row[1])) if stock_row else Decimal("0")
                on_hand_after = on_hand_before + post_qty

                if stock_row:
                    await self._session.execute(
                        text("""
                            UPDATE material_stock
                            SET on_hand = on_hand + :qty,
                                available = available + :qty,
                                updated_at = :now
                            WHERE material_code = :code
                        """),
                        {"qty": post_qty, "now": now, "code": line.item_code},
                    )
                else:
                    await self._session.execute(
                        text("""
                            INSERT INTO material_stock (id, material_code, material_name, category, on_hand, allocated, available, uom, warehouse_id, reorder_point, updated_at)
                            VALUES (:id, :code, :name, :cat, :qty, 0, :qty, :uom, :wh, 10, :now)
                        """),
                        {
                            "id": uuid.uuid4(),
                            "code": line.item_code,
                            "name": line.material_name or line.item_code,
                            "cat": line.material_category or "General",
                            "qty": post_qty,
                            "uom": line.uom or "PCS",
                            "wh": grn.warehouse_id or "WH-MAIN",
                            "now": now,
                        },
                    )

                # 2. Add inventory_receipt_posting entry
                await self._session.execute(
                    text("""
                        INSERT INTO inventory_receipt_posting
                        (id, grn_id, grn_number, po_id, po_number, asn_id, asn_number, supplier_name, item_code, material_name, uom, warehouse_id, posted_quantity, on_hand_before, on_hand_after, posted_by, posted_at)
                        VALUES (:id, :grn_id, :grn_num, :po_id, :po_num, :asn_id, :asn_num, :supplier, :code, :name, :uom, :wh, :qty, :before, :after, :user, :now)
                    """),
                    {
                        "id": uuid.uuid4(),
                        "grn_id": grn.id,
                        "grn_num": grn.grn_number,
                        "po_id": grn.po_id,
                        "po_num": grn.po_number,
                        "asn_id": grn.asn_id,
                        "asn_num": grn.asn_number,
                        "supplier": grn.supplier_name,
                        "code": line.item_code,
                        "name": line.material_name or line.item_code,
                        "uom": line.uom or "PCS",
                        "wh": grn.warehouse_id or "WH-MAIN",
                        "qty": post_qty,
                        "before": on_hand_before,
                        "after": on_hand_after,
                        "user": posted_by,
                        "now": now,
                    },
                )

                # 3. Create putaway task for line or batches
                task_num = f"PT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
                await self._session.execute(
                    text("""
                        INSERT INTO putaway_task
                        (id, task_number, grn_id, grn_number, item_code, material_name, quantity, uom, warehouse_id, source_location, status, created_by, created_at)
                        VALUES (:id, :task_num, :grn_id, :grn_num, :code, :name, :qty, :uom, :wh, :source, 'PUTAWAY_PENDING', :user, :now)
                    """),
                    {
                        "id": uuid.uuid4(),
                        "task_num": task_num,
                        "grn_id": grn.id,
                        "grn_num": grn.grn_number,
                        "code": line.item_code,
                        "name": line.material_name or line.item_code,
                        "qty": post_qty,
                        "uom": line.uom or "PCS",
                        "wh": grn.warehouse_id or "WH-MAIN",
                        "source": f"RECEIVING_DOCK_{grn.dock_number or '1'}",
                        "user": posted_by,
                        "now": now,
                    },
                )

        await self._session.flush()
        return grn

    async def list_grns(
        self,
        status: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[GrnModel], int]:
        stmt = select(GrnModel).options(selectinload(GrnModel.lines))
        conditions = []
        if status:
            conditions.append(GrnModel.status == status.strip())
        if search:
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    GrnModel.grn_number.ilike(term),
                    GrnModel.po_number.ilike(term),
                    GrnModel.supplier_name.ilike(term),
                    GrnModel.vehicle_number.ilike(term),
                )
            )
        if conditions:
            stmt = stmt.where(*conditions)

        total_res = await self._session.execute(stmt)
        total = len(total_res.scalars().all())

        stmt = stmt.order_by(GrnModel.created_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_grn_detail_by_id(self, grn_id_or_number: str | uuid.UUID) -> GrnModel | None:
        def _to_uuid(val):
            try:
                return uuid.UUID(str(val))
            except Exception:
                return None

        u_id = _to_uuid(grn_id_or_number)
        cond = GrnModel.id == u_id if u_id else GrnModel.grn_number.ilike(str(grn_id_or_number).strip())
        stmt = (
            select(GrnModel)
            .options(
                selectinload(GrnModel.lines).selectinload(GrnLineModel.damage_evidence),
                selectinload(GrnModel.lines).selectinload(GrnLineModel.batches).selectinload(GrnBatchModel.qr_code),
                selectinload(GrnModel.lines).selectinload(GrnLineModel.damage_lots).selectinload(GrnDamageLotModel.qr_code),
                selectinload(GrnModel.documents),
            )
            .where(cond)
        )
        res = await self._session.execute(stmt)
        return res.scalar_one_or_none()
