"""
FastAPI Router for Gate Entry REST API.
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.database.session import UnitOfWork, get_uow
from app.modules.gate.application.commands import CreateGateEntryCommand, ManualVerifyCommand
from app.modules.gate.application.interfaces import AnprService, OcrService
from app.modules.gate.application.mock_services import MockAnprService, MockOcrService
from app.modules.gate.application.use_cases import (
    CreateGateEntryUseCase,
    GetGateEntryUseCase,
    ListGateEntriesUseCase,
    ManualVerifyGateEntryUseCase,
)
from app.modules.gate.domain.enums import GateEntryStatus
from app.modules.gate.infrastructure.api.dto import GateEntryResponse, ManualVerifyRequest, gate_entry_to_response
from app.modules.gate.infrastructure.persistence.repository_impl import (
    SqlAlchemyGateEntryRepository,
    SqlAlchemyPurchaseOrderLookupRepository,
)
from app.modules.gate.infrastructure.services.file_storage import FileStorageService
from app.modules.gate.infrastructure.services.notification_impl import OutboxNotificationGateway
from app.modules.gate.infrastructure.services.gemini_service import GeminiVisionService
from app.security.dependencies import CurrentUser, get_current_user, require_permission

router = APIRouter(prefix="/api/gate-entries", tags=["gate-entry"])


def get_file_storage_service() -> FileStorageService:
    return FileStorageService()


def get_gemini_service() -> Optional[GeminiVisionService]:
    from app.config.settings import get_settings
    settings = get_settings()
    if settings.gemini_api_key:
        return GeminiVisionService(settings.gemini_api_key, settings.gemini_model)
    return None


def get_anpr_service(gemini: Optional[GeminiVisionService] = Depends(get_gemini_service)) -> AnprService:
    if gemini:
        return gemini
    return MockAnprService()


def get_ocr_service(gemini: Optional[GeminiVisionService] = Depends(get_gemini_service)) -> OcrService:
    if gemini:
        return gemini
    return MockOcrService()


@router.post("/scan-gemini")
async def scan_with_gemini(
    file: UploadFile = File(...),
    kind: str = Form("general"),
    instructions: Optional[str] = Form(None),
    current_user: CurrentUser = Depends(get_current_user),
    gemini: Optional[GeminiVisionService] = Depends(get_gemini_service),
) -> dict:
    """Extract all details from an uploaded file using Gemini."""
    if not gemini:
        raise HTTPException(status_code=400, detail="Gemini API Key not configured on server.")

    contents = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    try:
        if kind == "po":
            res = await gemini.process_po_document(contents, mime_type)
            return {
                "po_number": res.po_number,
                "supplier_name": res.supplier_name,
                "product_material": res.product_material,
                "quantity": str(res.quantity) if res.quantity else None,
            }
        if kind == "vehicle":
            res = await gemini.recognize_license_plate(contents, mime_type)
            return {
                "vehicle_number": res.detected_vehicle_number,
                "confidence": res.confidence,
                "extraction": res.raw_metadata.get("extraction", {}),
            }
        if kind == "license":
            res = await gemini.extract_license_details(contents, mime_type)
            fields = res.get("fields", {})
            return {
                "license_number": gemini._field(fields, "license_number", "dl_number", "id_number", "document_number"),
                "driver_name": gemini._field(fields, "driver_name", "full_name", "name", "holder_name"),
                "vehicle_number": gemini._field(fields, "vehicle_number", "license_plate", "plate_number"),
                "extraction": res,
            }
        return await gemini.extract_details(contents, mime_type, document_type=kind, instructions=instructions)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/scan")
async def scan_gate_entry(
    po_document: Annotated[Optional[UploadFile], File(description="Live camera capture of the PO document")] = None,
    vehicle_photo: Annotated[Optional[UploadFile], File(description="Live camera capture of the vehicle plate")] = None,
    current_user: CurrentUser = Depends(require_permission("gate:entry:create")),
    anpr_service: AnprService = Depends(get_anpr_service),
    ocr_service: OcrService = Depends(get_ocr_service),
) -> dict:
    """Run OCR and ANPR on live camera captures without creating a gate entry."""
    if po_document is None and vehicle_photo is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Capture a PO document or vehicle photo first.")

    result: dict = {}
    if po_document is not None:
        ocr = await ocr_service.process_po_document(await po_document.read())
        result["ocr"] = {
            "po_number": ocr.po_number,
            "supplier_name": ocr.supplier_name,
            "product_material": ocr.product_material,
            "quantity": str(ocr.quantity) if ocr.quantity is not None else None,
            "confidence": ocr.confidence,
        }
    if vehicle_photo is not None:
        anpr = await anpr_service.recognize_license_plate(await vehicle_photo.read())
        result["anpr"] = {
            "vehicle_number": anpr.detected_vehicle_number,
            "confidence": anpr.confidence,
        }
    return result


@router.post("", response_model=GateEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_gate_entry(
    po_document: Annotated[UploadFile, File(description="Scanned Purchase Order document file")],
    driver_photo: Annotated[Optional[UploadFile], File(description="Driver photograph file (optional)")] = None,
    po_number: Annotated[Optional[str], Form(description="Purchase Order Number (optional - extracted via OCR if omitted)")] = None,
    vehicle_number: Annotated[Optional[str], Form(description="Vehicle license plate number (optional - extracted via ANPR if omitted)")] = None,
    driver_name: Annotated[Optional[str], Form(description="Driver full name")] = "Driver",
    driver_license_number: Annotated[Optional[str], Form()] = None,
    driver_phone: Annotated[Optional[str], Form()] = None,
    vehicle_photo: Annotated[Optional[UploadFile], File(description="Captured truck photo file for ANPR")] = None,
    current_user: CurrentUser = Depends(require_permission("gate:entry:create")),
    uow: UnitOfWork = Depends(get_uow),
    file_storage: FileStorageService = Depends(get_file_storage_service),
    anpr_service: AnprService = Depends(get_anpr_service),
    ocr_service: OcrService = Depends(get_ocr_service),
) -> GateEntryResponse:
    """
    Create a new Security Gate Entry.
    Security captures vehicle photo for ANPR and scans PO document for OCR (no QR/barcode).
    Runs ANPR and OCR processing, checks PO in DB, detects mismatches, and logs audit trail.
    """
    po_doc_bytes = await po_document.read()

    driver_photo_bytes = None
    driver_photo_name = None
    driver_photo_type = None
    if driver_photo:
        driver_photo_bytes = await driver_photo.read()
        driver_photo_name = driver_photo.filename
        driver_photo_type = driver_photo.content_type

    vehicle_photo_bytes = None
    vehicle_photo_name = None
    vehicle_photo_type = None
    if vehicle_photo:
        vehicle_photo_bytes = await vehicle_photo.read()
        vehicle_photo_name = vehicle_photo.filename
        vehicle_photo_type = vehicle_photo.content_type

    command = CreateGateEntryCommand(
        po_number=po_number,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        driver_license_number=driver_license_number,
        driver_phone=driver_phone,
        security_officer_id=current_user.username,
        driver_photo_bytes=driver_photo_bytes,
        driver_photo_filename=driver_photo_name,
        driver_photo_content_type=driver_photo_type,
        po_document_bytes=po_doc_bytes,
        po_document_filename=po_document.filename or "po_document.pdf",
        po_document_content_type=po_document.content_type or "application/pdf",
        vehicle_photo_bytes=vehicle_photo_bytes,
        vehicle_photo_filename=vehicle_photo_name,
        vehicle_photo_content_type=vehicle_photo_type,
    )

    gate_repo = SqlAlchemyGateEntryRepository(uow.session)
    po_repo = SqlAlchemyPurchaseOrderLookupRepository(uow.session)
    notification_gw = OutboxNotificationGateway(uow.session)

    use_case = CreateGateEntryUseCase(
        gate_entry_repo=gate_repo,
        po_lookup_repo=po_repo,
        anpr_service=anpr_service,
        ocr_service=ocr_service,
        file_storage_service=file_storage,
        notification_gateway=notification_gw,
    )

    gate_entry = await use_case.execute(command)
    return gate_entry_to_response(gate_entry)


@router.get("", response_model=list[GateEntryResponse])
async def list_gate_entries(
    status: Optional[GateEntryStatus] = Query(None),
    po_number: Optional[str] = Query(None),
    vehicle_number: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(require_permission("gate:entry:read")),
    uow: UnitOfWork = Depends(get_uow),
) -> list[GateEntryResponse]:
    """
    List and filter Gate Entries.
    """
    gate_repo = SqlAlchemyGateEntryRepository(uow.session)
    use_case = ListGateEntriesUseCase(gate_repo)
    entries = await use_case.execute(
        status=status,
        po_number=po_number,
        vehicle_number=vehicle_number,
        limit=limit,
        offset=offset,
    )
    return [gate_entry_to_response(e) for e in entries]


@router.get("/{id}", response_model=GateEntryResponse)
async def get_gate_entry(
    id: str,
    current_user: CurrentUser = Depends(require_permission("gate:entry:read")),
    uow: UnitOfWork = Depends(get_uow),
) -> GateEntryResponse:
    """
    Get a single Gate Entry by ID including full audit logs and verification results.
    """
    gate_repo = SqlAlchemyGateEntryRepository(uow.session)
    use_case = GetGateEntryUseCase(gate_repo)
    entry = await use_case.execute(id)
    return gate_entry_to_response(entry)


@router.post("/{id}/verify", response_model=GateEntryResponse)
async def manual_verify_gate_entry(
    id: str,
    request: ManualVerifyRequest,
    current_user: CurrentUser = Depends(require_permission("gate:entry:verify")),
    uow: UnitOfWork = Depends(get_uow),
) -> GateEntryResponse:
    """
    Manual verification endpoint for Security Supervisor or Warehouse Manager.
    Approves or rejects a Gate Entry that required manual verification or was unscheduled.
    """
    command = ManualVerifyCommand(
        gate_entry_id=id,
        approved=request.approved,
        verified_by_user_id=current_user.username,
        notes=request.notes,
    )

    gate_repo = SqlAlchemyGateEntryRepository(uow.session)
    notification_gw = OutboxNotificationGateway(uow.session)

    use_case = ManualVerifyGateEntryUseCase(
        gate_entry_repo=gate_repo,
        notification_gateway=notification_gw,
    )

    entry = await use_case.execute(command)
    return gate_entry_to_response(entry)
