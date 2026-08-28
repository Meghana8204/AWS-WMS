from __future__ import annotations

import os
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.database.session import UnitOfWork, get_uow
from app.modules.receiving.application.commands import (
    ConfirmGrnCommand,
    ConfirmGrnLine,
    GetGrnContextQuery,
)
from app.modules.receiving.application.exceptions import (
    PurchaseOrderNotFoundException,
)
from app.modules.receiving.application.use_cases import (
    ConfirmGrnUseCase,
    GetGrnContextUseCase,
)
from app.modules.receiving.infrastructure.api.schemas import (
    BatchQuantityRequest,
    BatchWithQrResponse,
    CompleteGrnRequest,
    CompleteGrnResponse,
    ConfirmGrnRequest,
    CreateGrnHeaderRequest,
    DamageEvidenceResponse,
    DockOptionResponse,
    GrnBatchQrResponse,
    GrnBatchResponse,
    GrnContextLineResponse,
    GrnContextResponse,
    GrnDetailResponse,
    GrnDocumentResponse,
    GrnHeaderResponse,
    GrnLineResponse,
    GrnListResponse,
    GrnResponse,
    GrnSummaryResponse,
    QualityInspectionRequest,
    QualityInspectionResponse,
    UpdateGrnLinesRequest,
    UpdateGrnLinesResponse,
)
from app.modules.receiving.infrastructure.persistence.repository_impl import (
    SqlAlchemyGrnRepository,
)
from app.security.dependencies import CurrentUser, get_current_user, require_permission

router = APIRouter(
    prefix="/api/receiving/grn",
    tags=["receiving"],
)

UPLOAD_DIR = os.path.join(os.getcwd(), "media_uploads", "grn_documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# LIST GRNS
# ============================================================================

@router.get("", response_model=GrnListResponse)
async def list_grns(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:read")),
) -> GrnListResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    items, total = await repo.list_grns(status=status, search=search, limit=limit, offset=offset)

    return GrnListResponse(
        total=total,
        items=[
            GrnSummaryResponse(
                grn_id=str(g.id),
                grn_number=g.grn_number,
                po_number=g.po_number,
                supplier_name=g.supplier_name,
                receipt_type=g.receipt_type,
                status=g.status,
                warehouse_name=g.warehouse_name,
                dock_number=g.dock_number,
                receipt_date=g.receipt_date,
                received_by=g.received_by,
            )
            for g in items
        ],
    )


# ============================================================================
# PAGE 1 - CONTEXT
# ============================================================================

@router.get("/context", response_model=GrnContextResponse)
async def get_grn_context(
    po_id: str | None = Query(default=None),
    po_number: str | None = Query(default=None),
    gate_entry_id: str | None = Query(default=None),
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:read")),
) -> GrnContextResponse:
    normalized_po_id = po_id.strip() if po_id else None
    normalized_po_number = po_number.strip() if po_number else None
    normalized_gate_entry_id = gate_entry_id.strip() if gate_entry_id else None

    if not normalized_po_id and not normalized_po_number:
        raise HTTPException(
            status_code=422,
            detail="Either po_id or po_number is required",
        )

    repo = SqlAlchemyGrnRepository(uow.session)
    use_case = GetGrnContextUseCase(repo)

    try:
        context = await use_case.handle(
            GetGrnContextQuery(
                po_id=normalized_po_id,
                po_number=normalized_po_number,
                gate_entry_id=normalized_gate_entry_id,
            )
        )
    except PurchaseOrderNotFoundException:
        raise HTTPException(
            status_code=404,
            detail="PO Number not found",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"PO details could not be fetched: {str(e)}",
        )

    asn = context.asn
    gate = context.gate_entry
    existing = context.existing_grn

    # Single Source of Truth for Vehicle & Driver: Gate Entry (or ASN fallback)
    vehicle_number = (
        (gate.vehicle_number if gate else None)
        or (asn.vehicle_number if asn else None)
        or (existing.vehicle_number if existing else None)
    )

    driver_name = (
        (gate.driver_name if gate else None)
        or (asn.driver_name if asn else None)
        or (existing.driver_name if existing else None)
    )

    # Pre-fill Receiving Dock from Gate Entry assigned dock if available
    prefilled_dock = gate.assigned_dock_id if gate and gate.assigned_dock_id else None

    field_sources = {
        "po_header": "purchase_orders DB table",
        "po_items": "purchase_order_items DB table",
        "material_category": "material master table (material.category)",
        "vehicle_and_driver": "gate_entry DB table" if gate else "asn DB table",
        "asn_reference": "asn DB table (via gate_entry.asn_id)" if gate and gate.asn_id else "asn DB table",
        "receiving_dock": "gate_entry.assigned_dock_id" if prefilled_dock else "manual selection",
    }

    return GrnContextResponse(
        receipt_type=context.receipt_type,
        po_id=context.po_id,
        po_number=context.po_number,
        grn_id=(existing.id if existing else None),
        grn_number=(existing.grn_number if existing else None),
        grn_status=(existing.status if existing else None),
        asn_id=(asn.id if asn else None),
        asn_number=(asn.asn_number if asn else None),
        gate_entry_id=(gate.id if gate else None),
        gate_entry_number=(gate.gate_entry_number if gate else None),
        supplier_name=context.supplier_name,
        supplier_company_name=context.supplier_company_name,
        warehouse_id=context.warehouse_id,
        warehouse_name=context.warehouse_name,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        invoice_number=(existing.invoice_number if existing else None),
        received_by=(existing.received_by if existing else None),
        prefilled_dock_number=prefilled_dock,
        field_sources=field_sources,
        dock_options=[
            DockOptionResponse(
                dock_number=dock.dock_number,
                warehouse_id=dock.warehouse_id,
                dock_type=dock.dock_type,
                capacity=dock.capacity,
                status=dock.status,
            )
            for dock in context.dock_options
        ],
        lines=[
            GrnContextLineResponse(
                item_code=line.item_code,
                material_name=line.material_name,
                material_category=line.material_category,
                uom=line.uom,
                ordered_quantity=line.ordered_quantity,
                received_quantity=line.received_quantity,
                balance_quantity=line.balance_quantity,
            )
            for line in context.lines
        ],
    )


# ============================================================================
# PAGE 1 - CREATE / SAVE HEADER
# ============================================================================

@router.post("/header", response_model=GrnHeaderResponse)
async def create_grn_header(
    request: CreateGrnHeaderRequest,
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
    _perm=Depends(require_permission("receiving:write")),
) -> GrnHeaderResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    grn = await repo.create_or_update_grn_header(
        receipt_type=request.receipt_type,
        dock_number=request.dock_number,
        po_id=request.po_id,
        po_number=request.po_number,
        invoice_number=request.invoice_number,
        supplier_name=request.supplier_name,
        supplier_company_name=request.supplier_company_name,
        warehouse_id=request.warehouse_id,
        warehouse_name=request.warehouse_name,
        vehicle_number=request.vehicle_number,
        driver_name=request.driver_name,
        received_by=user.username or "System User",
        verification_notes=request.verification_notes,
    )

    return GrnHeaderResponse(
        grn_id=str(grn.id),
        grn_number=grn.grn_number,
        receipt_type=grn.receipt_type,
        status=grn.status,
        po_id=str(grn.po_id) if grn.po_id else None,
        po_number=grn.po_number,
        asn_id=str(grn.asn_id) if grn.asn_id else None,
        asn_number=grn.asn_number,
        gate_entry_id=str(grn.gate_entry_id) if grn.gate_entry_id else None,
        gate_entry_number=grn.gate_entry_number,
        supplier_name=grn.supplier_name,
        supplier_company_name=grn.supplier_company_name,
        warehouse_id=grn.warehouse_id,
        warehouse_name=grn.warehouse_name,
        dock_number=grn.dock_number,
        vehicle_number=grn.vehicle_number,
        driver_name=grn.driver_name,
        invoice_number=grn.invoice_number,
        receipt_date=grn.receipt_date,
        received_by=grn.received_by,
        verification_notes=grn.verification_notes,
        created_at=grn.created_at,
        updated_at=grn.updated_at,
    )


# ============================================================================
# PAGE 2 - UPDATE LINES
# ============================================================================

@router.put("/{grn_id}/lines", response_model=UpdateGrnLinesResponse)
async def update_grn_lines(
    grn_id: str,
    request: UpdateGrnLinesRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:write")),
) -> UpdateGrnLinesResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    grn = await repo.update_grn_lines(
        grn_id=uuid.UUID(grn_id),
        lines_data=[line.model_dump() for line in request.lines],
    )

    return UpdateGrnLinesResponse(
        grn_id=str(grn.id),
        grn_number=grn.grn_number,
        status=grn.status,
        lines=[
            GrnLineResponse(
                grn_line_id=str(line.id),
                item_code=line.item_code,
                material_name=line.material_name,
                material_category=line.material_category,
                uom=line.uom,
                ordered_quantity=line.ordered_quantity,
                received_quantity=line.received_quantity,
                good_quantity=line.good_quantity,
                damaged_quantity=line.damaged_quantity,
                accepted_quantity=line.accepted_quantity,
                rejected_quantity=line.rejected_quantity,
                quality_approved_quantity=line.quality_approved_quantity,
                balance_quantity=line.balance_quantity,
                quality_result=line.quality_result,
            )
            for line in grn.lines
        ],
    )


# ============================================================================
# PAGE 3 - DAMAGE EVIDENCE
# ============================================================================

@router.post("/lines/{grn_line_id}/damage-evidence", response_model=DamageEvidenceResponse)
async def upload_damage_evidence(
    grn_line_id: str,
    damaged_quantity: float = Form(...),
    reason: str | None = Form(default=None),
    remarks: str | None = Form(default=None),
    file: UploadFile = File(...),
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
    _perm=Depends(require_permission("receiving:write")),
) -> DamageEvidenceResponse:
    file_ext = os.path.splitext(file.filename or "evidence.jpg")[1]
    saved_filename = f"damage_{uuid.UUID(grn_line_id).hex[:8]}_{uuid.uuid4().hex[:4]}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, saved_filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    rel_path = f"/media/grn_documents/{saved_filename}"

    repo = SqlAlchemyGrnRepository(uow.session)
    evidence = await repo.add_damage_evidence(
        grn_line_id=uuid.UUID(grn_line_id),
        damaged_quantity=Decimal(str(damaged_quantity)),
        reason=reason,
        remarks=remarks,
        file_name=file.filename or saved_filename,
        file_path=rel_path,
        uploaded_by=user.username or "System User",
    )

    return DamageEvidenceResponse(
        evidence_id=str(evidence.id),
        grn_line_id=str(evidence.grn_line_id),
        damaged_quantity=evidence.damaged_quantity,
        reason=evidence.reason,
        remarks=evidence.remarks,
        file_name=evidence.file_name,
        file_path=evidence.file_path,
        uploaded_by=evidence.uploaded_by,
        uploaded_at=evidence.uploaded_at,
    )


# ============================================================================
# PAGE 4 - QUALITY INSPECTION
# ============================================================================

@router.post("/{grn_id}/quality", response_model=QualityInspectionResponse)
async def update_quality_inspection(
    grn_id: str,
    request: QualityInspectionRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:write")),
) -> QualityInspectionResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    grn = await repo.update_quality_inspection(
        grn_id=uuid.UUID(grn_id),
        quality_data=[line.model_dump() for line in request.lines],
    )

    return QualityInspectionResponse(
        grn_id=str(grn.id),
        status=grn.status,
        lines=[
            GrnLineResponse(
                grn_line_id=str(line.id),
                item_code=line.item_code,
                material_name=line.material_name,
                material_category=line.material_category,
                uom=line.uom,
                ordered_quantity=line.ordered_quantity,
                received_quantity=line.received_quantity,
                good_quantity=line.good_quantity,
                damaged_quantity=line.damaged_quantity,
                accepted_quantity=line.accepted_quantity,
                rejected_quantity=line.rejected_quantity,
                quality_approved_quantity=line.quality_approved_quantity,
                balance_quantity=line.balance_quantity,
                quality_result=line.quality_result,
            )
            for line in grn.lines
        ],
    )


# ============================================================================
# PAGE 5 & 6 - BATCH CREATION & BATCH QR
# ============================================================================

@router.post("/lines/{grn_line_id}/batches", response_model=list[BatchWithQrResponse])
async def create_batches_for_line(
    grn_line_id: str,
    batches: list[BatchQuantityRequest],
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
    _perm=Depends(require_permission("receiving:write")),
) -> list[BatchWithQrResponse]:
    repo = SqlAlchemyGrnRepository(uow.session)
    created_batches = await repo.create_batches_for_line(
        grn_line_id=uuid.UUID(grn_line_id),
        batch_quantities=[b.batch_quantity for b in batches],
        created_by=user.username or "System User",
    )

    result = []
    for b in created_batches:
        qr_resp = None
        if b.qr_code:
            qr_resp = GrnBatchQrResponse(
                qr_id=str(b.qr_code.id),
                batch_id=str(b.id),
                qr_code=b.qr_code.qr_code,
                qr_payload=f"BATCH:{b.batch_number}|QTY:{b.batch_quantity}",
                generated_at=b.qr_code.generated_at,
            )

        result.append(
            BatchWithQrResponse(
                batch=GrnBatchResponse(
                    batch_id=str(b.id),
                    grn_line_id=str(b.grn_line_id),
                    batch_number=b.batch_number,
                    batch_quantity=b.batch_quantity,
                    created_by=b.created_by,
                    created_at=b.created_at,
                ),
                qr=qr_resp,
            )
        )
    return result


# ============================================================================
# PAGE 7 - DOCUMENTS
# ============================================================================

@router.post("/{grn_id}/documents", response_model=GrnDocumentResponse)
async def upload_grn_document(
    grn_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
    _perm=Depends(require_permission("receiving:write")),
) -> GrnDocumentResponse:
    file_ext = os.path.splitext(file.filename or "document.pdf")[1]
    saved_filename = f"doc_{uuid.UUID(grn_id).hex[:8]}_{uuid.uuid4().hex[:4]}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, saved_filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    rel_path = f"/media/grn_documents/{saved_filename}"

    repo = SqlAlchemyGrnRepository(uow.session)
    doc = await repo.add_document(
        grn_id=uuid.UUID(grn_id),
        document_type=document_type.upper(),
        file_name=file.filename or saved_filename,
        file_path=rel_path,
        uploaded_by=user.username or "System User",
    )

    return GrnDocumentResponse(
        document_id=str(doc.id),
        grn_id=str(doc.grn_id),
        document_type=doc.document_type,
        file_name=doc.file_name,
        file_path=doc.file_path,
        uploaded_by=doc.uploaded_by,
        uploaded_at=doc.uploaded_at,
    )


# ============================================================================
# PAGE 8 - POST / COMPLETE GRN
# ============================================================================

@router.post("/{grn_id}/complete", response_model=CompleteGrnResponse)
async def complete_grn(
    grn_id: str,
    request: CompleteGrnRequest | None = None,
    uow: UnitOfWork = Depends(get_uow),
    user: CurrentUser = Depends(get_current_user),
    _perm=Depends(require_permission("receiving:write")),
) -> CompleteGrnResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    notes = request.verification_notes if request else None
    grn = await repo.complete_grn_posting(
        grn_id=uuid.UUID(grn_id),
        posted_by=user.username or "System User",
        verification_notes=notes,
    )

    return CompleteGrnResponse(
        grn_id=str(grn.id),
        grn_number=grn.grn_number,
        status=grn.status,
        posted_by=grn.posted_by,
        posted_at=grn.posted_at,
        message="GRN posted successfully. Material stock updated and putaway tasks created.",
    )


# ============================================================================
# LEGACY CONFIRM GRN
# ============================================================================

@router.post("", response_model=GrnResponse)
async def confirm(
    request: ConfirmGrnRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:write")),
) -> GrnResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    use_case = ConfirmGrnUseCase(repo)

    command = ConfirmGrnCommand(
        po_id=request.po_id,
        lines=[
            ConfirmGrnLine(
                item_code=line.item_code,
                quantity=line.quantity,
            )
            for line in request.lines
        ],
    )

    grn_id = await use_case.handle(command)

    return GrnResponse(
        grn_id=str(grn_id.value),
        status="CONFIRMED",
    )


# ============================================================================
# GET FULL GRN DETAIL
# ============================================================================

@router.get("/{grn_id}", response_model=GrnDetailResponse)
async def get_grn_detail(
    grn_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user=Depends(require_permission("receiving:read")),
) -> GrnDetailResponse:
    repo = SqlAlchemyGrnRepository(uow.session)
    grn = await repo.get_grn_detail_by_id(uuid.UUID(grn_id))

    if not grn:
        raise HTTPException(status_code=404, detail=f"GRN not found: {grn_id}")

    return GrnDetailResponse(
        grn_id=str(grn.id),
        grn_number=grn.grn_number,
        status=grn.status,
        receipt_type=grn.receipt_type,
        po_id=str(grn.po_id) if grn.po_id else None,
        po_number=grn.po_number,
        asn_id=str(grn.asn_id) if grn.asn_id else None,
        asn_number=grn.asn_number,
        gate_entry_id=str(grn.gate_entry_id) if grn.gate_entry_id else None,
        gate_entry_number=grn.gate_entry_number,
        supplier_name=grn.supplier_name,
        supplier_company_name=grn.supplier_company_name,
        warehouse_id=grn.warehouse_id,
        warehouse_name=grn.warehouse_name,
        dock_number=grn.dock_number,
        vehicle_number=grn.vehicle_number,
        driver_name=grn.driver_name,
        invoice_number=grn.invoice_number,
        receipt_date=grn.receipt_date,
        received_by=grn.received_by,
        posted_by=grn.posted_by,
        posted_at=grn.posted_at,
        verification_notes=grn.verification_notes,
        created_at=grn.created_at,
        updated_at=grn.updated_at,
        lines=[
            GrnLineResponse(
                grn_line_id=str(line.id),
                item_code=line.item_code,
                material_name=line.material_name,
                material_category=line.material_category,
                uom=line.uom,
                ordered_quantity=line.ordered_quantity,
                received_quantity=line.received_quantity,
                good_quantity=line.good_quantity,
                damaged_quantity=line.damaged_quantity,
                accepted_quantity=line.accepted_quantity,
                rejected_quantity=line.rejected_quantity,
                quality_approved_quantity=line.quality_approved_quantity,
                balance_quantity=line.balance_quantity,
                quality_result=line.quality_result,
            )
            for line in grn.lines
        ],
        documents=[
            GrnDocumentResponse(
                document_id=str(doc.id),
                grn_id=str(doc.grn_id),
                document_type=doc.document_type,
                file_name=doc.file_name,
                file_path=doc.file_path,
                uploaded_by=doc.uploaded_by,
                uploaded_at=doc.uploaded_at,
            )
            for doc in grn.documents
        ],
    )

