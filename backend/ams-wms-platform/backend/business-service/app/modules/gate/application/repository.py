"""
Gate Entry Repository Interface Protocol.
"""
from typing import Optional, Protocol
from app.modules.gate.domain.gate_entry import GateEntry


class GateEntryRepositoryProtocol(Protocol):
    async def save(self, gate_entry: GateEntry) -> GateEntry:
        ...

    async def get_by_id(self, gate_entry_id: str) -> Optional[GateEntry]:
        ...

    async def get_by_vehicle(self, vehicle_number: str) -> Optional[GateEntry]:
        ...

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[GateEntry], int]:
        ...
