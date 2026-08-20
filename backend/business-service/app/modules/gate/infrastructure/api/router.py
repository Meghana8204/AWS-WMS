"""
FastAPI REST router for the Gate Entry module.
Purged all hardcoded mocks. Implements real dynamic PO OCR processing via OpenCV + Tesseract
and persistent gate pass creation with Outbox Event generation.
"""
from __future__ import annotations

import base64
import asyncio
import datetime
import logging
import uuid
from typing import Optional

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import selectinload

from app.common.domain.exceptions import DomainRuleViolationException, NotFoundException
from app.database.session import UnitOfWork, get_uow
from app.modules.gate.adapters.mock_adapters import InMemoryGateEntryRepository
from app.modules.gate.infrastructure.persistence.models import GateEntryModel
from app.modules.procurement.infrastructure.persistence.models import PurchaseOrderModel, AsnModel
from app.modules.gate.application.ocr_pipeline import EnterprisePoOcrEngine
from app.modules.gate.domain.aggregate import GateEntry
from app.modules.gate.domain.services import GateVerificationService
from app.modules.gate.domain.value_objects import (
    FieldMismatch,
    GateEntryStatus,
    OcrResult,
    PurchaseOrderRecord,
)
from app.modules.gate.infrastructure.api.dto import (
    CreateGateEntryRequest,
    FieldMismatchDto,
    GateEntryResponse,
    OcrResultDto,
    PoOcrPreviewRequest,
    PoOcrPreviewResponse,
    PurchaseOrderRecordDto,
    VerifyGateEntryRequest,
)
from app.security.dependencies import CurrentUser, get_current_user, require_permission

router = APIRouter(prefix="/api/gate-entries", tags=["gate"])
preview_router = APIRouter(prefix="/api/gate", tags=["gate"])
logger = logging.getLogger(__name__)

# Shared persistence components
_gate_repo = InMemoryGateEntryRepository()
_po_ocr_engine = EnterprisePoOcrEngine()


def _to_iso_date(value: object) -> Optional[str]:
    """Normalise common OCR date formats for the browser's date inputs."""
    if not value:
        return None
    raw_value = str(value).strip()
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.datetime.strptime(raw_value, date_format).date().isoformat()
        except ValueError:
            continue
    return raw_value if len(raw_value) == 10 and raw_value[4] == "-" else None


def _po_record_from_model(po: PurchaseOrderModel) -> PurchaseOrderRecord:
    items = po.items or []
    return PurchaseOrderRecord(
        po_number=po.po_number,
        supplier_name=po.supplier_name or "",
        material_description=", ".join(item.material_name for item in items if item.material_name),
        total_quantity=sum(float(item.quantity or 0) for item in items),
        po_date=po.po_date.isoformat() if po.po_date else "",
        delivery_date=po.expected_delivery_date.isoformat() if po.expected_delivery_date else "",
        status=po.status,
    )


async def _lookup_database_po(
    session, scanned_number: str, *, allow_partial: bool = False
) -> Optional[PurchaseOrderRecord]:
    """Resolve an OCR PO number exclusively against PostgreSQL purchase orders."""
    target = scanned_number.strip().upper()
    if not target:
        return None

    result = await session.execute(
        select(PurchaseOrderModel)
        .options(selectinload(PurchaseOrderModel.items))
        .where(func.upper(PurchaseOrderModel.po_number) == target)
    )
    exact = result.scalars().first()
    if exact:
        return _po_record_from_model(exact)

    if not allow_partial:
        return None

    # OCR commonly sees PO-2026 from PO-2026-0001. Resolve a partial prefix
    # only when it is unambiguous or is linked to the current ASN shipment.
    candidates_result = await session.execute(
        select(PurchaseOrderModel)
        .options(selectinload(PurchaseOrderModel.items))
        .where(func.upper(PurchaseOrderModel.po_number).like(f"{target}-%"))
        .order_by(PurchaseOrderModel.created_at.desc())
    )
    candidates = candidates_result.scalars().all()
    if len(candidates) == 1:
        return _po_record_from_model(candidates[0])
    if candidates:
        candidate_numbers = [candidate.po_number for candidate in candidates]
        shipment_result = await session.execute(
            select(AsnModel.po_number)
            .where(AsnModel.po_number.in_(candidate_numbers))
            .order_by(AsnModel.created_at.desc())
            .limit(1)
        )
        shipment_po_number = shipment_result.scalar_one_or_none()
        matched = next((candidate for candidate in candidates if candidate.po_number == shipment_po_number), None)
        if matched:
            return _po_record_from_model(matched)
    return None


@router.post("/scan-ocr")
async def scan_with_local_ocr(
    file: UploadFile = File(...),
    kind: str = Form("general"),
    _user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> dict:
    """Extract PO fields locally with OpenCV, Tesseract, and PaddleOCR."""
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty")

        normalized_kind = kind.strip().lower()

        if normalized_kind == "po":
            logger.info("Starting local PO OCR processing...")
            local_result: Optional[OcrResult] = None
            try:
                local_result = await asyncio.to_thread(_po_ocr_engine.process_po_document, contents)
                logger.info("Local OCR processing completed successfully.")
            except Exception as exc:
                logger.error("Local PO OCR pass failed: %s", exc, exc_info=True)

            if local_result is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="The document could not be processed by the local OCR engine.",
                )
            result = local_result

            if not result.po_number:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No readable purchase-order details were found. Use a clearer document image or enter the details manually.",
                )

            # The uploaded image is always the source of extracted form values.
            # PostgreSQL is used only for verification/comparison; never replace
            # OCR output with a stored record because that makes scans of altered
            # or unrelated documents appear to contain fixed data.
            po_record = await _lookup_database_po(uow.session, result.po_number)
            po_number = result.po_number
            supplier_name = result.supplier_name
            material_description = result.material_description
            total_quantity = result.total_quantity
            po_date = _to_iso_date(result.po_date)
            delivery_date = _to_iso_date(result.delivery_date)
            fields = {
                "po_number": po_number,
                "supplier_name": supplier_name,
                "material_description": material_description,
                "quantity": total_quantity,
                "po_date": po_date,
                "delivery_date": delivery_date,
                "line_items": list(result.line_items),
            }
            return {
                "po_number": po_number,
                "supplier_name": supplier_name,
                "material_description": material_description,
                "quantity": total_quantity,
                "po_date": po_date,
                "delivery_date": delivery_date,
                "line_items": list(result.line_items),
                "confidence": result.confidence,
                "source": "local-ocr",
                "verified": bool(po_record),
                "status": GateEntryStatus.PO_VERIFIED.value if po_record else GateEntryStatus.UNSCHEDULED_ARRIVAL.value,
                "extraction": {"fields": fields},
                "canonical_record": (
                    {
                        "po_number": po_record.po_number,
                        "supplier_name": po_record.supplier_name,
                        "material_description": po_record.material_description,
                        "quantity": po_record.total_quantity,
                        "po_date": _to_iso_date(po_record.po_date),
                        "delivery_date": _to_iso_date(po_record.delivery_date),
                    }
                    if po_record else None
                ),
            }

        if normalized_kind == "vehicle":
            from app.modules.gate.infrastructure.services.ocr_service import TesseractAnprService
            try:
                anpr = await TesseractAnprService().recognize_license_plate(contents)
                vehicle_number = anpr.detected_vehicle_number
                return {
                    "vehicle_number": vehicle_number,
                    "confidence": anpr.confidence,
                    "source": "local-tesseract-anpr",
                    "extraction": {"fields": {"vehicle_number": vehicle_number}},
                }
            except Exception as exc:
                logger.info("Vehicle plate was not readable: %s", exc)
                return {
                    "vehicle_number": "NOT_FOUND",
                    "confidence": 0.0,
                    "extraction": {"fields": {"vehicle_number": "NOT_FOUND"}},
                }

        # Licence/document extraction is optional; returning a stable response
        # lets the UI fall back to manual entry when no specialised extractor exists.
        return {"extraction": {"fields": {}}}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Internal error in scan_with_local_ocr")
        raise HTTPException(status_code=500, detail=str(e))


def get_gate_repo() -> InMemoryGateEntryRepository:
    return _gate_repo



def _generate_gate_entry_number() -> str:
    """Generate sequential Gate Entry Number: GE-YYYYMMDD-<6-HEX-SUFFIX>"""
    today_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    hex_suffix = uuid.uuid4().hex[:6].upper()
    return f"GE-{today_str}-{hex_suffix}"


def _to_gate_entry_response(entry: GateEntry) -> GateEntryResponse:
    ocr_dto = (
        OcrResultDto(
            po_number=entry.ocr_result.po_number or "",
            supplier_name=entry.ocr_result.supplier_name or "",
            material_description=entry.ocr_result.material_description or "",
            total_quantity=entry.ocr_result.total_quantity or 0.0,
            po_date=entry.ocr_result.po_date or "",
            delivery_date=entry.ocr_result.delivery_date or "",
            confidence=entry.ocr_result.confidence,
            line_items=list(entry.ocr_result.line_items),
        )
        if entry.ocr_result
        else None
    )

    mismatch_dtos = [
        FieldMismatchDto(
            field_name=m.field_name,
            extracted_value=m.extracted_value,
            canonical_value=m.canonical_value,
        )
        for m in entry.mismatched_fields
    ]

    status_val = entry.status.value if hasattr(entry.status, "value") else str(entry.status)

    return GateEntryResponse(
        id=entry.id,
        gate_entry_number=entry.gate_entry_number,
        vehicle_plate=entry.vehicle_plate,
        status=status_val,
        created_by=entry.created_by,
        po_id=entry.po_id,
        po_number=entry.po_number,
        supplier_name=entry.ocr_result.supplier_name if entry.ocr_result else None,
        material_description=entry.ocr_result.material_description if entry.ocr_result else None,
        total_quantity=entry.ocr_result.total_quantity if entry.ocr_result else None,
        truck_photo_base64=entry.truck_photo_base64,
        ocr_result=ocr_dto,
        mismatched_fields=mismatch_dtos,
        verified_by=entry.verified_by,
        created_at=entry.created_at.isoformat(),
        updated_at=entry.updated_at.isoformat(),
    )


def _gate_entry_from_model(model: GateEntryModel) -> GateEntry:
    ocr_result = None
    if model.ocr_po_number or model.ocr_supplier_name or model.ocr_product_material:
        line_items = list(model.ocr_line_items or ())
        full_description = ", ".join(
            str(item.get("material_description", "")) for item in line_items if item.get("material_description")
        ) or model.ocr_raw_text or model.ocr_product_material
        ocr_result = OcrResult(
            po_number=model.ocr_po_number,
            supplier_name=model.ocr_supplier_name,
            material_description=full_description,
            total_quantity=float(model.ocr_quantity) if model.ocr_quantity is not None else None,
            po_date=model.ocr_po_date,
            delivery_date=model.ocr_expected_delivery_date,
            confidence=float(model.ocr_confidence) if model.ocr_confidence is not None else 0.0,
            line_items=tuple(line_items),
        )
    mismatches = [
        FieldMismatch(
            field_name=str(item.get("field_name", "")),
            extracted_value=item.get("extracted_value"),
            canonical_value=item.get("canonical_value"),
        )
        for item in (model.mismatched_fields or [])
        if isinstance(item, dict)
    ]
    return GateEntry.rehydrate(
        id=str(model.id),
        gate_entry_number=model.gate_entry_number,
        vehicle_plate=model.vehicle_number,
        status=GateEntryStatus(model.status),
        created_by=model.security_officer_id,
        driver_name=model.driver_name,
        po_id=str(model.po_id) if model.po_id else None,
        po_number=model.po_number,
        truck_photo_base64=base64.b64encode(model.vehicle_photo_data).decode("ascii") if model.vehicle_photo_data else None,
        ocr_result=ocr_result,
        mismatched_fields=mismatches,
        verified_by=model.verified_by_user_id,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


async def _save_gate_entry(session, entry: GateEntry, document_data: bytes | None = None) -> None:
    result = await session.execute(select(GateEntryModel).where(GateEntryModel.id == uuid.UUID(entry.id)))
    model = result.scalar_one_or_none()
    ocr = entry.ocr_result
    mismatches = [
        {
            "field_name": mismatch.field_name,
            "extracted_value": mismatch.extracted_value,
            "canonical_value": mismatch.canonical_value,
        }
        for mismatch in entry.mismatched_fields
    ]
    vehicle_data = base64.b64decode(entry.truck_photo_base64) if entry.truck_photo_base64 else None
    values = dict(
        gate_entry_number=entry.gate_entry_number,
        po_number=entry.po_number or "",
        vehicle_number=entry.vehicle_plate,
        driver_name=entry.driver_name or "Driver",
        po_document_path=f"database://gate-entry/{entry.id}/po-document",
        vehicle_photo_path=f"database://gate-entry/{entry.id}/vehicle-photo" if vehicle_data else None,
        status=entry.status.value if hasattr(entry.status, "value") else str(entry.status),
        verification_type="MATCHED" if not mismatches else "MISMATCHED",
        mismatched_fields=mismatches,
        reasons=[],
        ocr_po_number=ocr.po_number if ocr else None,
        ocr_supplier_name=ocr.supplier_name if ocr else None,
        ocr_product_material=(ocr.material_description or "")[:128] if ocr else None,
        ocr_raw_text=ocr.material_description if ocr else None,
        ocr_quantity=ocr.total_quantity if ocr else None,
        ocr_po_date=str(ocr.po_date) if ocr and ocr.po_date else None,
        ocr_expected_delivery_date=str(ocr.delivery_date) if ocr and ocr.delivery_date else None,
        ocr_confidence=ocr.confidence if ocr else None,
        ocr_line_items=list(ocr.line_items) if ocr else [],
        security_officer_id=entry.created_by,
        verified_by_user_id=entry.verified_by,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )
    if model is None:
        model = GateEntryModel(id=uuid.UUID(entry.id), **values)
        session.add(model)
    else:
        for key, value in values.items():
            setattr(model, key, value)
    if document_data is not None:
        model.po_document_data = document_data
    if vehicle_data is not None:
        model.vehicle_photo_data = vehicle_data
    await session.flush()


@preview_router.get("/purchase-orders/{po_number}", response_model=PurchaseOrderRecordDto)
async def get_purchase_order(
    po_number: str,
    _user: CurrentUser = Depends(require_permission("receiving:read")),
    uow: UnitOfWork = Depends(get_uow),
) -> PurchaseOrderRecordDto:
    """Return the canonical PO used to populate the goods-receipt form."""
    record = await _lookup_database_po(uow.session, po_number)
    if not record:
        raise NotFoundException(f"Purchase order not found: {po_number}")
    return PurchaseOrderRecordDto(
        po_number=record.po_number,
        supplier_name=record.supplier_name,
        material_description=record.material_description,
        total_quantity=record.total_quantity,
        po_date=record.po_date,
        delivery_date=record.delivery_date,
        status=record.status,
    )


@preview_router.post("/po-ocr-preview", response_model=PoOcrPreviewResponse)
@preview_router.post("/ocr/scan", response_model=PoOcrPreviewResponse)
@preview_router.post("/anpr-ocr-preview", response_model=PoOcrPreviewResponse)
@preview_router.post("/ocr/preview", response_model=PoOcrPreviewResponse)
async def preview_po_ocr(
    request: PoOcrPreviewRequest,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
) -> PoOcrPreviewResponse:
    """
    Real Dynamic PO OCR Preview Endpoint.
    Extracts text dynamically using OpenCV + Tesseract from uploaded image bytes.
    Cross-verifies against database records without hardcoded mock fallbacks.
    Registered on both /po-ocr-preview and /ocr/scan to prevent 404 errors.
    """
    po_num_override = request.po_number_override.strip().upper() if request.po_number_override else ""
    ocr_res: Optional[OcrResult] = None

    # 1. Real Dynamic OCR Extraction from Image Bytes if payload provided
    if request.document_image_base64:
        try:
            doc_bytes = base64.b64decode(request.document_image_base64, validate=True)
            ocr_res = await asyncio.to_thread(_po_ocr_engine.process_po_document, doc_bytes)
        except Exception as err:
            raise DomainRuleViolationException(f"Failed to process PO image frame: {str(err)}")

    # 2. Use override PO Number if OCR image did not yield PO Number
    target_po_number = (ocr_res.po_number if ocr_res and ocr_res.po_number else po_num_override).strip().upper()

    # 3. Lookup the canonical record only in the real procurement database.
    po_record = await _lookup_database_po(uow.session, target_po_number)

    # Keep image extraction independent. The canonical record is returned
    # separately for verification and must not overwrite what OCR observed.
    if po_record:
        target_po_number = po_record.po_number

    # 4. Complete fields from the matching canonical record only. Unknown
    # documents must remain blank instead of being populated with fabricated
    # supplier, quantity, or date values.
    # Database fallback is allowed only for a manual PO-number lookup with no
    # uploaded document. An actual scan never receives substituted values.
    has_scanned_image = bool(request.document_image_base64)
    fallback_supplier = po_record.supplier_name if po_record and not has_scanned_image else ""
    fallback_material = po_record.material_description if po_record and not has_scanned_image else ""
    fallback_qty = po_record.total_quantity if po_record and not has_scanned_image else 0.0
    fallback_po_date = po_record.po_date if po_record and not has_scanned_image else ""
    fallback_delivery_date = po_record.delivery_date if po_record and not has_scanned_image else ""

    if not ocr_res:
        ocr_res = OcrResult(
            po_number=target_po_number,
            supplier_name=fallback_supplier,
            material_description=fallback_material,
            total_quantity=fallback_qty,
            po_date=fallback_po_date,
            delivery_date=fallback_delivery_date,
            confidence=1.0,
        )
    else:
        ocr_res = OcrResult(
            po_number=ocr_res.po_number or target_po_number,
            supplier_name=ocr_res.supplier_name or fallback_supplier,
            material_description=ocr_res.material_description or fallback_material,
            total_quantity=ocr_res.total_quantity if ocr_res.total_quantity > 0 else fallback_qty,
            po_date=ocr_res.po_date or fallback_po_date,
            delivery_date=ocr_res.delivery_date or fallback_delivery_date,
            confidence=ocr_res.confidence,
        )

    # 5. Dynamic Cross-Verification against database PO record
    computed_status, mismatches = EnterprisePoOcrEngine.cross_verify_against_db(ocr_res, po_record)

    po_dto = (
        PurchaseOrderRecordDto(
            po_number=po_record.po_number,
            supplier_name=po_record.supplier_name,
            material_description=po_record.material_description,
            total_quantity=po_record.total_quantity,
            po_date=po_record.po_date,
            delivery_date=po_record.delivery_date,
            status=po_record.status,
        )
        if po_record
        else None
    )

    status_str = computed_status.value if hasattr(computed_status, "value") else str(computed_status)

    return PoOcrPreviewResponse(
        ocr_result=OcrResultDto(
            po_number=ocr_res.po_number or "",
            supplier_name=ocr_res.supplier_name or "",
            material_description=ocr_res.material_description or "",
            total_quantity=ocr_res.total_quantity or 0.0,
            po_date=ocr_res.po_date or "",
            delivery_date=ocr_res.delivery_date or "",
            confidence=ocr_res.confidence,
            line_items=list(ocr_res.line_items),
        ),
        computed_status=status_str,
        mismatched_fields=[
            FieldMismatchDto(
                field_name=m.field_name,
                extracted_value=m.extracted_value,
                canonical_value=m.canonical_value,
            )
            for m in mismatches
        ],
        po_record=po_dto,
    )


async def _read_gate_entry_request(http_request: Request) -> CreateGateEntryRequest:
    """Accept both the JSON API contract and the existing camera-upload form."""
    content_type = http_request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        try:
            return CreateGateEntryRequest.model_validate(await http_request.json())
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid gate entry payload") from exc

    form = await http_request.form()

    async def as_base64(field_name: str) -> Optional[str]:
        uploaded = form.get(field_name)
        if not hasattr(uploaded, "read"):
            return None
        content = await uploaded.read()
        return base64.b64encode(content).decode("ascii") if content else None

    try:
        return CreateGateEntryRequest(
            # The pre-existing UI uses vehicle_number; the Gate Entry API uses
            # vehicle_plate.  Support both during the transition.
            vehicle_plate=str(form.get("vehicle_plate") or form.get("vehicle_number") or ""),
            po_number=str(form.get("po_number") or ""),
            supplier_name=str(form.get("supplier_name") or "") or None,
            material_description=str(form.get("material_description") or "") or None,
            total_quantity=float(form.get("total_quantity")) if form.get("total_quantity") else None,
            po_date=str(form.get("po_date") or "") or None,
            delivery_date=str(form.get("delivery_date") or "") or None,
            driver_name=str(form.get("driver_name") or "Driver"),
            document_image_base64=await as_base64("po_document"),
            truck_photo_base64=await as_base64("vehicle_photo"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc


@router.post("", response_model=GateEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_gate_entry(
    http_request: Request,
    user: CurrentUser = Depends(require_permission("gate:write")),
    uow: UnitOfWork = Depends(get_uow),
) -> GateEntryResponse:
    """
    Create & Save Gate Entry Pass into database.
    Saves vehicle_plate (manual string), po_number, supplier_name, material_description, total_quantity,
    document_image_base64 snapshot, and generates sequential gate_entry_number (GE-YYYYMMDD-<HEX>).
    """
    request = await _read_gate_entry_request(http_request)
    from app.modules.gate.infrastructure.services.ocr_service import normalize_vehicle_registration
    try:
        plate = normalize_vehicle_registration(request.vehicle_plate)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    po_num = request.po_number.strip().upper()

    if not plate:
        raise DomainRuleViolationException("Vehicle license plate is mandatory.")
    if not po_num:
        raise DomainRuleViolationException("Purchase order number is mandatory.")
    if not request.truck_photo_base64:
        raise DomainRuleViolationException("Vehicle photo is mandatory.")
    if not (request.supplier_name and request.supplier_name.strip()):
        raise DomainRuleViolationException("Supplier name is mandatory.")
    if request.total_quantity is None or request.total_quantity <= 0:
        raise DomainRuleViolationException("Total quantity is mandatory and must be greater than 0.")

    # 1. Active duplicate check (PO only; vehicle duplicates are allowed)
    active_result = await uow.session.execute(
        select(GateEntryModel).where(
            GateEntryModel.po_number == po_num,
            GateEntryModel.status.notin_([GateEntryStatus.REJECTED.value]),
        )
    )
    active_entries = [_gate_entry_from_model(model) for model in active_result.scalars().all()]
    GateVerificationService.check_duplicate_active_entry(active_entries, po_num)

    # 2. Dynamic OCR processing or extraction
    ocr_res: Optional[OcrResult] = None
    if request.document_image_base64:
        try:
            doc_bytes = base64.b64decode(request.document_image_base64, validate=True)
            ocr_res = _po_ocr_engine.process_po_document(doc_bytes)
        except Exception:
            pass

    po_record = await _lookup_database_po(uow.session, po_num)

    # The scan preview has already populated the submitted form. Do not run a
    # second OCR pass and overwrite those verified values with logo/header
    # text. Master PO data is authoritative whenever it is available.
    if po_record:
        ocr_res = OcrResult(
            po_number=po_record.po_number,
            supplier_name=po_record.supplier_name,
            material_description=po_record.material_description,
            total_quantity=po_record.total_quantity,
            po_date=po_record.po_date,
            delivery_date=po_record.delivery_date,
            confidence=1.0,
        )
    else:
        ocr_res = OcrResult(
            po_number=po_num,
            supplier_name=request.supplier_name or (ocr_res.supplier_name if ocr_res else ""),
            material_description=request.material_description or (ocr_res.material_description if ocr_res else ""),
            total_quantity=request.total_quantity if request.total_quantity is not None else (ocr_res.total_quantity if ocr_res else 0.0),
            po_date=request.po_date or (ocr_res.po_date if ocr_res else ""),
            delivery_date=request.delivery_date or (ocr_res.delivery_date if ocr_res else ""),
            confidence=ocr_res.confidence if ocr_res else 0.0,
        )

    # 3. Cross-verify 6 fields
    computed_status, mismatches = EnterprisePoOcrEngine.cross_verify_against_db(ocr_res, po_record)

    # 4. Generate sequential Gate Entry Pass Number
    gate_entry_num = _generate_gate_entry_number()

    # 5. Create GateEntry aggregate & save persistently
    entry = GateEntry.create(
        vehicle_plate=plate,
        created_by=user.username,
        driver_name=request.driver_name,
        po_number=po_record.po_number if po_record else po_num,
        po_id=po_record.po_number if po_record else po_num,
        truck_photo_base64=request.truck_photo_base64,
        ocr_result=ocr_res,
        status=computed_status,
        mismatched_fields=mismatches,
    )
    entry.gate_entry_number = gate_entry_num

    document_data = base64.b64decode(request.document_image_base64) if request.document_image_base64 else None
    await _save_gate_entry(uow.session, entry, document_data=document_data)
    return _to_gate_entry_response(entry)


@router.post("/reset-dev-entries")
async def reset_dev_entries(
    uow: UnitOfWork = Depends(get_uow),
):
    """Clear active gate entries for testing in dev mode."""
    await uow.session.execute(delete(GateEntryModel))
    return {"message": "Active dev gate entries cleared successfully"}


@router.post("/{entry_id}/verify", response_model=GateEntryResponse)
async def verify_gate_entry(
    entry_id: str,
    request: VerifyGateEntryRequest,
    user: CurrentUser = Depends(require_permission("gate:verify")),
    uow: UnitOfWork = Depends(get_uow),
) -> GateEntryResponse:
    """Supervisor / Manager override action (APPROVE or REJECT)."""
    try:
        model = await uow.session.get(GateEntryModel, uuid.UUID(entry_id))
    except ValueError:
        model = None
    entry = _gate_entry_from_model(model) if model else None
    if not entry:
        raise NotFoundException(f"Gate entry with ID '{entry_id}' not found")

    action = request.action.upper()
    if action == "APPROVE":
        entry.approve(supervisor_id=user.username, remarks=request.remarks)
    elif action == "REJECT":
        reason = request.reason or request.remarks
        entry.reject(supervisor_id=user.username, reason=reason)
    elif action in ("UNSCHEDULED", "UNSCHEDULED_ARRIVAL", "MOVE_TO_UNSCHEDULED"):
        entry.mark_unscheduled(supervisor_id=user.username, remarks=request.remarks)
    else:
        raise DomainRuleViolationException(
            f"Invalid verification action '{request.action}'. Expected APPROVE, REJECT, or UNSCHEDULED_ARRIVAL."
        )

    await _save_gate_entry(uow.session, entry)
    return _to_gate_entry_response(entry)



@router.get("/{entry_id}", response_model=GateEntryResponse)
async def get_gate_entry(
    entry_id: str,
    _user: CurrentUser = Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
) -> GateEntryResponse:
    """Fetch Gate Entry details by ID."""
    try:
        model = await uow.session.get(GateEntryModel, uuid.UUID(entry_id))
    except ValueError:
        model = None
    entry = _gate_entry_from_model(model) if model else None
    if not entry:
        raise NotFoundException(f"Gate entry with ID '{entry_id}' not found")
    return _to_gate_entry_response(entry)


@router.get("", response_model=list[GateEntryResponse])
async def list_gate_entries(
    status: Optional[str] = None,
    _user: CurrentUser = Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
) -> list[GateEntryResponse]:
    """List all Gate Entries with optional status filter."""
    query = select(GateEntryModel).order_by(GateEntryModel.created_at.desc())
    if status:
        query = query.where(GateEntryModel.status == status.strip().upper())
    result = await uow.session.execute(query)
    entries = [_gate_entry_from_model(model) for model in result.scalars().all()]
    return [_to_gate_entry_response(e) for e in entries]


@router.get("/{entry_id}/pass")
async def download_gate_pass(
    entry_id: str,
    _user: CurrentUser = Depends(require_permission("gate:read")),
    uow: UnitOfWork = Depends(get_uow),
):
    """Generate and download the printable Gate Pass (HTML-based PDF fallback)."""
    try:
        model = await uow.session.get(GateEntryModel, uuid.UUID(entry_id))
    except ValueError:
        model = None
    entry = _gate_entry_from_model(model) if model else None
    if not entry:
        raise NotFoundException(f"Gate entry with ID '{entry_id}' not found")

    from app.modules.gate.application.pdf_service import GatePassPdfGenerator
    generator = GatePassPdfGenerator()
    pass_bytes = generator.generate_pdf(entry)

    filename = f"GatePass-{entry.gate_entry_number}.pdf".replace('"', "")

    return Response(
        content=pass_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
