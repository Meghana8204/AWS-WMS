"""
FastAPI Router for Gate Entry Management endpoints.
"""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.gate.application.use_cases import (
    AssignGateDockUseCase,
    CreateGateEntryUseCase,
    GateCheckOutUseCase,
    RecordWeighbridgeUseCase,
    SearchGateASNUseCase,
)
from app.modules.gate.infrastructure.api.schemas import (
    GateCheckInCreateDTO,
    GateDockAssignDTO,
    GateEntryListResponseDTO,
    GateEntryResponseDTO,
    WeighbridgeRecordDTO,
)
from app.modules.gate.infrastructure.persistence.repository_impl import SQLAlchemyGateEntryRepository
from app.modules.procurement.infrastructure.api.schemas import ASNResponseSchema, ASNItemSchema
from app.modules.procurement.infrastructure.persistence.repository_impl import SqlAlchemyASNRepository, SqlAlchemyMaterialRequestRepository

router = APIRouter(prefix="/api/v1/gate", tags=["Gate Entry Management"])


def _to_response_dto(g) -> GateEntryResponseDTO:
    return GateEntryResponseDTO(
        id=g.id,
        gate_entry_number=g.gate_entry_number,
        warehouse_id=g.warehouse_id,
        vehicle_number=g.vehicle_number,
        supplier_name=g.supplier_name,
        driver_name=g.driver_name,
        driver_phone=g.driver_phone,
        asn_id=g.asn_id,
        asn_number=g.asn_number,
        po_id=g.po_id,
        po_number=g.po_number,
        supplier_id=g.supplier_id,
        assigned_dock_id=g.assigned_dock_id,
        security_officer_id=g.security_officer_id,
        verification_notes=g.verification_notes,
        status=g.status.value,
        entry_time=g.entry_time,
        exit_time=g.exit_time,
        gross_weight_kg=g.weighbridge.gross_weight_kg,
        tare_weight_kg=g.weighbridge.tare_weight_kg,
        net_weight_kg=g.weighbridge.net_weight_kg,
        created_at=g.created_at,
        updated_at=g.updated_at,
    )


@router.post("/entries", response_model=GateEntryResponseDTO, status_code=status.HTTP_201_CREATED)
async def check_in_vehicle(
    dto: GateCheckInCreateDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SQLAlchemyGateEntryRepository(db)
    asn_repo = SqlAlchemyASNRepository(db)
    use_case = CreateGateEntryUseCase(repo, asn_repo)
    try:
        entry = await use_case.execute(
            warehouse_id=dto.warehouse_id,
            vehicle_number=dto.vehicle_number,
            driver_name=dto.driver_name,
            driver_phone=dto.driver_phone,
            supplier_name=dto.supplier_name,
            asn_id=dto.asn_id,
            po_id=dto.po_id,
            security_officer_id=dto.security_officer_id,
            verification_notes=dto.verification_notes,
        )
        await db.commit()
        return _to_response_dto(entry)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/entries/{id}/assign-dock", response_model=GateEntryResponseDTO)
async def assign_dock(
    id: str,
    dto: GateDockAssignDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SQLAlchemyGateEntryRepository(db)
    use_case = AssignGateDockUseCase(repo)
    try:
        entry = await use_case.execute(gate_entry_id=id, dock_id=dto.dock_id)
        await db.commit()
        return _to_response_dto(entry)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/entries/{id}/weighbridge", response_model=GateEntryResponseDTO)
async def record_weighbridge(
    id: str,
    dto: WeighbridgeRecordDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SQLAlchemyGateEntryRepository(db)
    use_case = RecordWeighbridgeUseCase(repo)
    try:
        entry = await use_case.execute(gate_entry_id=id, gross_weight_kg=dto.gross_weight_kg, tare_weight_kg=dto.tare_weight_kg)
        await db.commit()
        return _to_response_dto(entry)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/entries/{id}/check-out", response_model=GateEntryResponseDTO)
async def check_out_vehicle(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SQLAlchemyGateEntryRepository(db)
    use_case = GateCheckOutUseCase(repo)
    try:
        entry = await use_case.execute(gate_entry_id=id)
        await db.commit()
        return _to_response_dto(entry)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/entries", response_model=GateEntryListResponseDTO)
async def list_gate_entries(
    db: Annotated[AsyncSession, Depends(get_db)],
    status_param: Optional[str] = Query(None, alias="status"),
    warehouse_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = SQLAlchemyGateEntryRepository(db)
    items, total = await repo.list_all(status=status_param, warehouse_id=warehouse_id, skip=skip, limit=limit)
    return GateEntryListResponseDTO(
        items=[_to_response_dto(g) for g in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/asns/search", response_model=Optional[ASNResponseSchema])
async def search_asn_at_gate(
    query: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    asn_repo = SqlAlchemyASNRepository(db)
    use_case = SearchGateASNUseCase(asn_repo)
    asn = await use_case.execute(query)
    if not asn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No matching ASN found for query '{query}'")

    return ASNResponseSchema(
        id=asn.id,
        asn_number=asn.asn_number,
        po_id=asn.po_id,
        po_number=asn.po_number,
        supplier_id=asn.supplier_id,
        supplier_name=asn.supplier_name,
        warehouse_id=asn.warehouse_id,
        shipped_date=asn.shipped_date,
        expected_arrival_date=asn.expected_arrival_date,
        transporter_name=asn.transporter_name,
        tracking_number=asn.tracking_number,
        vehicle_number=asn.vehicle_number,
        driver_name=asn.driver_name,
        driver_phone=asn.driver_phone,
        status=asn.status.value,
        items=[
            ASNItemSchema(
                po_item_id=it.po_item_id,
                material_code=it.material_code,
                material_name=it.material_name,
                ordered_qty=it.ordered_qty,
                shipped_qty=it.shipped_qty,
                unit_of_measure=it.unit_of_measure,
                batch_number=it.batch_number,
                expiry_date=it.expiry_date,
            )
            for it in asn.items
        ],
        total_shipped_qty=asn.total_shipped_qty,
        created_at=asn.created_at,
        updated_at=asn.updated_at,
    )
