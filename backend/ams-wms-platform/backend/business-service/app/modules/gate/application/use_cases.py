"""
Gate Entry Application Use Cases.
"""
from decimal import Decimal
from typing import Optional

from app.modules.gate.application.repository import GateEntryRepositoryProtocol
from app.modules.gate.domain.events import GateDockAssignedEvent, GateEntryCreatedEvent
from app.modules.gate.domain.gate_entry import GateEntry, GateEntryStatus
from app.modules.procurement.application.repository import ASNRepositoryProtocol


class CreateGateEntryUseCase:
    def __init__(self, repo: GateEntryRepositoryProtocol, asn_repo: ASNRepositoryProtocol | None = None):
        self.repo = repo
        self.asn_repo = asn_repo

    async def execute(
        self,
        warehouse_id: str,
        vehicle_number: str,
        driver_name: str,
        driver_phone: str,
        supplier_name: str | None = None,
        asn_id: str | None = None,
        po_id: str | None = None,
        security_officer_id: str | None = None,
        verification_notes: str | None = None,
    ) -> GateEntry:
        asn_number = None
        po_number = None
        supplier_id = None
        supp_name = supplier_name or "Unknown Supplier"

        if asn_id and self.asn_repo:
            asn = await self.asn_repo.get_by_id(asn_id)
            if asn:
                asn_number = asn.asn_number
                po_id = asn.po_id
                po_number = asn.po_number
                supplier_id = asn.supplier_id
                supp_name = asn.supplier_name
                asn.mark_gate_checked_in()
                await self.asn_repo.save(asn)

        entry = GateEntry.create_check_in(
            warehouse_id=warehouse_id,
            vehicle_number=vehicle_number,
            supplier_name=supp_name,
            driver_name=driver_name,
            driver_phone=driver_phone,
            asn_id=asn_id,
            asn_number=asn_number,
            po_id=po_id,
            po_number=po_number,
            supplier_id=supplier_id,
            security_officer_id=security_officer_id,
            verification_notes=verification_notes,
        )

        entry.recorded_events.append(
            GateEntryCreatedEvent(
                gate_entry_id=entry.id,
                gate_entry_number=entry.gate_entry_number,
                vehicle_number=entry.vehicle_number,
                warehouse_id=entry.warehouse_id,
                asn_id=entry.asn_id,
            )
        )

        return await self.repo.save(entry)


class AssignGateDockUseCase:
    def __init__(self, repo: GateEntryRepositoryProtocol):
        self.repo = repo

    async def execute(self, gate_entry_id: str, dock_id: str) -> GateEntry:
        entry = await self.repo.get_by_id(gate_entry_id)
        if not entry:
            raise ValueError(f"Gate Entry '{gate_entry_id}' not found")

        entry.assign_dock(dock_id)
        entry.recorded_events.append(
            GateDockAssignedEvent(
                gate_entry_id=entry.id,
                vehicle_number=entry.vehicle_number,
                dock_id=entry.assigned_dock_id,
            )
        )
        return await self.repo.save(entry)


class RecordWeighbridgeUseCase:
    def __init__(self, repo: GateEntryRepositoryProtocol):
        self.repo = repo

    async def execute(self, gate_entry_id: str, gross_weight_kg: Decimal | float, tare_weight_kg: Decimal | float = 0.0) -> GateEntry:
        entry = await self.repo.get_by_id(gate_entry_id)
        if not entry:
            raise ValueError(f"Gate Entry '{gate_entry_id}' not found")

        entry.record_weighbridge(gross_weight_kg=gross_weight_kg, tare_weight_kg=tare_weight_kg)
        return await self.repo.save(entry)


class GateCheckOutUseCase:
    def __init__(self, repo: GateEntryRepositoryProtocol):
        self.repo = repo

    async def execute(self, gate_entry_id: str) -> GateEntry:
        entry = await self.repo.get_by_id(gate_entry_id)
        if not entry:
            raise ValueError(f"Gate Entry '{gate_entry_id}' not found")

        entry.check_out()
        return await self.repo.save(entry)


class SearchGateASNUseCase:
    def __init__(self, asn_repo: ASNRepositoryProtocol):
        self.asn_repo = asn_repo

    async def execute(self, search_query: str) -> Optional[object]:
        term = search_query.strip()
        asn = await self.asn_repo.get_by_vehicle(term)
        if not asn:
            asn = await self.asn_repo.get_by_id(term)
        if not asn:
            asn = await self.asn_repo.get_by_po_id(term)
        return asn
