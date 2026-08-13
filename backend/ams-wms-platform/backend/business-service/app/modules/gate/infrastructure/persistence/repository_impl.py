"""
SQLAlchemy Implementation of GateEntryRepositoryProtocol.
"""
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.outbox_repository import to_outbox_row
from app.modules.gate.application.repository import GateEntryRepositoryProtocol
from app.modules.gate.domain.gate_entry import GateEntry, GateEntryStatus, WeighbridgeData
from app.modules.gate.infrastructure.persistence.models import GateEntryModel


class SQLAlchemyGateEntryRepository(GateEntryRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, gate_entry: GateEntry) -> GateEntry:
        model = await self._session.get(GateEntryModel, gate_entry.id)
        if not model:
            model = GateEntryModel(id=gate_entry.id)
            self._session.add(model)

        model.gate_entry_number = gate_entry.gate_entry_number
        model.warehouse_id = gate_entry.warehouse_id
        model.vehicle_number = gate_entry.vehicle_number
        model.supplier_name = gate_entry.supplier_name
        model.driver_name = gate_entry.driver_name
        model.driver_phone = gate_entry.driver_phone
        model.asn_id = gate_entry.asn_id
        model.asn_number = gate_entry.asn_number
        model.po_id = gate_entry.po_id
        model.po_number = gate_entry.po_number
        model.supplier_id = gate_entry.supplier_id
        model.assigned_dock_id = gate_entry.assigned_dock_id
        model.security_officer_id = gate_entry.security_officer_id
        model.verification_notes = gate_entry.verification_notes
        model.status = gate_entry.status.value if isinstance(gate_entry.status, GateEntryStatus) else str(gate_entry.status)
        model.entry_time = gate_entry.entry_time
        model.exit_time = gate_entry.exit_time
        model.gross_weight_kg = gate_entry.weighbridge.gross_weight_kg
        model.tare_weight_kg = gate_entry.weighbridge.tare_weight_kg
        model.updated_at = gate_entry.updated_at

        for event in gate_entry.recorded_events:
            self._session.add(to_outbox_row("GateEntry", gate_entry.id, event))
        gate_entry.recorded_events.clear()

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, gate_entry_id: str) -> Optional[GateEntry]:
        model = await self._session.get(GateEntryModel, gate_entry_id)
        return self._to_domain(model) if model else None

    async def get_by_vehicle(self, vehicle_number: str) -> Optional[GateEntry]:
        stmt = select(GateEntryModel).where(GateEntryModel.vehicle_number == vehicle_number.strip().upper()).order_by(GateEntryModel.created_at.desc())
        model = (await self._session.execute(stmt)).scalars().first()
        return self._to_domain(model) if model else None

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[GateEntry], int]:
        stmt = select(GateEntryModel)
        count_stmt = select(func.count(GateEntryModel.id))

        if status:
            stmt = stmt.where(GateEntryModel.status == status)
            count_stmt = count_stmt.where(GateEntryModel.status == status)
        if warehouse_id:
            stmt = stmt.where(GateEntryModel.warehouse_id == warehouse_id)
            count_stmt = count_stmt.where(GateEntryModel.warehouse_id == warehouse_id)

        stmt = stmt.order_by(GateEntryModel.created_at.desc()).offset(skip).limit(limit)
        total = (await self._session.execute(count_stmt)).scalar() or 0
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models], total

    def _to_domain(self, m: GateEntryModel) -> GateEntry:
        wb = WeighbridgeData(
            gross_weight_kg=m.gross_weight_kg,
            tare_weight_kg=m.tare_weight_kg,
        )
        return GateEntry(
            id=m.id,
            gate_entry_number=m.gate_entry_number,
            warehouse_id=m.warehouse_id,
            vehicle_number=m.vehicle_number,
            supplier_name=m.supplier_name,
            driver_name=m.driver_name,
            driver_phone=m.driver_phone,
            asn_id=m.asn_id,
            asn_number=m.asn_number,
            po_id=m.po_id,
            po_number=m.po_number,
            supplier_id=m.supplier_id,
            assigned_dock_id=m.assigned_dock_id,
            security_officer_id=m.security_officer_id,
            verification_notes=m.verification_notes,
            status=GateEntryStatus(m.status),
            entry_time=m.entry_time,
            exit_time=m.exit_time,
            weighbridge=wb,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
