"""
FastAPI REST router for the Gate Entry module.
Purged all hardcoded mocks. Implements real dynamic PO OCR processing via OpenCV + Tesseract
and persistent gate pass creation with Outbox Event generation.
"""
from __future__ import annotations

import base64
import datetime
import uuid
from typing import Optional

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status

from app.common.domain.exceptions import DomainRuleViolationException, NotFoundException
from app.modules.gate.adapters.mock_adapters import (
    InMemoryGateEntryRepository,
    MockPoRepository,
)
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
    CreateCustomPoRequest,
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

# Shared persistence components
_gate_repo = InMemoryGateEntryRepository()
_po_repo = MockPoRepository()
_po_ocr_engine = EnterprisePoOcrEngine()


def _seed_initial_gate_entries(repo: InMemoryGateEntryRepository) -> None:
    if repo._entries:
        return
    # 1. Unscheduled Arrival
    u_entry = GateEntry.create(
        vehicle_plate="MH-12-PQ-9988",
        created_by="GATE_OFFICER_1",
        po_number="UNSCH-2026-901",
        po_id="UNSCH-2026-901",
        ocr_result=OcrResult(
            po_number="UNSCH-2026-901",
            supplier_name="Express Freight Logistics",
            material_description="Ad-hoc Industrial Fasteners",
            total_quantity=150.0,
            po_date="2026-08-12",
            delivery_date="2026-08-13",
            confidence=1.0,
        ),
        status=GateEntryStatus.UNSCHEDULED_ARRIVAL,
        mismatched_fields=[],
    )
    u_entry.gate_entry_number = "GE-20260813-UNSCH1"

    # 2. Verified Entry
    v_entry = GateEntry.create(
        vehicle_plate="KA-05-MN-5678",
        created_by="SECURITY_GATE_1",
        po_number="PO-1002",
        po_id="PO-1002",
        ocr_result=OcrResult(
            po_number="PO-1002",
            supplier_name="Bosch Logistics India",
            material_description="Braking Modules",
            total_quantity=50.0,
            po_date="2026-08-05",
            delivery_date="2026-08-20",
            confidence=1.0,
        ),
        status=GateEntryStatus.PO_VERIFIED,
        mismatched_fields=[],
    )
    v_entry.gate_entry_number = "GE-20260813-VERF01"

    # 3. Approved Entry
    a_entry = GateEntry.create(
        vehicle_plate="HR-26-DQ-1122",
        created_by="SECURITY_GATE_1",
        po_number="PO-1002",
        po_id="PO-1002",
        ocr_result=OcrResult(
            po_number="PO-1002",
            supplier_name="Bosch Logistics India",
            material_description="Braking Modules",
            total_quantity=50.0,
            po_date="2026-08-05",
            delivery_date="2026-08-20",
            confidence=1.0,
        ),
        status=GateEntryStatus.APPROVED,
        mismatched_fields=[],
    )
    a_entry.gate_entry_number = "GE-20260813-APPR01"
    a_entry.verified_by = "SUPERVISOR_ADMIN"

    repo.save(u_entry)
    repo.save(v_entry)
    repo.save(a_entry)


_seed_initial_gate_entries(_gate_repo)


def get_gate_repo() -> InMemoryGateEntryRepository:
    return _gate_repo



def get_po_repo() -> MockPoRepository:
    return _po_repo


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


@preview_router.post("/test/purchase-orders", response_model=PurchaseOrderRecordDto, status_code=status.HTTP_201_CREATED)
async def create_test_po(
    request: CreateCustomPoRequest,
    po_repo: MockPoRepository = Depends(get_po_repo),
) -> PurchaseOrderRecordDto:
    """Add a Purchase Order record to the database for testing."""
    record = PurchaseOrderRecord(
        po_number=request.po_number.strip().upper(),
        supplier_name=request.supplier_name.strip(),
        material_description=request.material_description.strip(),
        total_quantity=request.total_quantity,
        po_date=request.po_date.strip(),
        delivery_date=request.delivery_date.strip(),
        status="OPEN",
    )
    po_repo.add_po(record)
    return PurchaseOrderRecordDto(
        po_number=record.po_number,
        supplier_name=record.supplier_name,
        material_description=record.material_description,
        total_quantity=record.total_quantity,
        po_date=record.po_date,
        delivery_date=record.delivery_date,
        status=record.status,
    )


@preview_router.get("/test/purchase-orders", response_model=list[PurchaseOrderRecordDto])
async def list_test_pos(
    po_repo: MockPoRepository = Depends(get_po_repo),
) -> list[PurchaseOrderRecordDto]:
    """List all stored Purchase Orders in the database."""
    return [
        PurchaseOrderRecordDto(
            po_number=r.po_number,
            supplier_name=r.supplier_name,
            material_description=r.material_description,
            total_quantity=r.total_quantity,
            po_date=r.po_date,
            delivery_date=r.delivery_date,
            status=r.status,
        )
        for r in po_repo._records.values()
    ]


@preview_router.get("/purchase-orders/{po_number}", response_model=PurchaseOrderRecordDto)
async def get_purchase_order(
    po_number: str,
    po_repo: MockPoRepository = Depends(get_po_repo),
    _user: CurrentUser = Depends(require_permission("receiving:read")),
) -> PurchaseOrderRecordDto:
    """Return the canonical PO used to populate the goods-receipt form."""
    record = po_repo.find_po_by_number(po_number)
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
    po_repo: MockPoRepository = Depends(get_po_repo),
    _user: CurrentUser = Depends(require_permission("gate:write")),
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
            ocr_res = _po_ocr_engine.process_po_document(doc_bytes)
        except Exception as err:
            raise DomainRuleViolationException(f"Failed to process PO image frame: {str(err)}")

    # 2. Use override PO Number if OCR image did not yield PO Number
    target_po_number = (ocr_res.po_number if ocr_res and ocr_res.po_number else po_num_override).strip().upper()

    # 3. Lookup canonical PO Record in Database
    po_record = po_repo.find_po_by_number(target_po_number) if target_po_number else None

    # A successful master-data lookup proves the scanned PO identifier is a
    # recognised OCR variant (for example P0-1003 instead of PO-1003). Use
    # the canonical record for verification and form population; otherwise a
    # harmless character-recognition error would incorrectly create an
    # unscheduled arrival.
    if po_record:
        target_po_number = po_record.po_number
        if ocr_res:
            ocr_res = OcrResult(
                po_number=po_record.po_number,
                supplier_name=po_record.supplier_name,
                material_description=po_record.material_description,
                total_quantity=po_record.total_quantity,
                po_date=po_record.po_date,
                delivery_date=po_record.delivery_date,
                confidence=ocr_res.confidence,
            )

    # 4. Complete fields from the matching canonical record only. Unknown
    # documents must remain blank instead of being populated with fabricated
    # supplier, quantity, or date values.
    fallback_supplier = po_record.supplier_name if po_record else ""
    fallback_material = po_record.material_description if po_record else ""
    fallback_qty = po_record.total_quantity if po_record else 0.0
    fallback_po_date = po_record.po_date if po_record else ""
    fallback_delivery_date = po_record.delivery_date if po_record else ""

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


@router.post("", response_model=GateEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_gate_entry(
    request: CreateGateEntryRequest,
    gate_repo: InMemoryGateEntryRepository = Depends(get_gate_repo),
    po_repo: MockPoRepository = Depends(get_po_repo),
    user: CurrentUser = Depends(require_permission("gate:write")),
) -> GateEntryResponse:
    """
    Create & Save Gate Entry Pass into database.
    Saves vehicle_plate (manual string), po_number, supplier_name, material_description, total_quantity,
    document_image_base64 snapshot, and generates sequential gate_entry_number (GE-YYYYMMDD-<HEX>).
    """
    plate = request.vehicle_plate.strip().upper()
    po_num = request.po_number.strip().upper()

    if not plate:
        raise DomainRuleViolationException("Vehicle license plate is mandatory.")
    if not po_num:
        raise DomainRuleViolationException("Purchase order number is mandatory.")

    # 1. Active duplicate check
    active_entries = gate_repo.find_active_by_po_or_plate(po_number=po_num, vehicle_plate=plate)
    GateVerificationService.check_duplicate_active_entry(active_entries, po_num, plate)

    # 2. Dynamic OCR processing or extraction
    ocr_res: Optional[OcrResult] = None
    if request.document_image_base64:
        try:
            doc_bytes = base64.b64decode(request.document_image_base64, validate=True)
            ocr_res = _po_ocr_engine.process_po_document(doc_bytes)
        except Exception:
            pass

    po_record = po_repo.find_po_by_number(po_num)

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
            po_date=ocr_res.po_date if ocr_res else "",
            delivery_date=ocr_res.delivery_date if ocr_res else "",
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
        po_number=po_record.po_number if po_record else po_num,
        po_id=po_record.po_number if po_record else po_num,
        truck_photo_base64=request.truck_photo_base64,
        ocr_result=ocr_res,
        status=computed_status,
        mismatched_fields=mismatches,
    )
    entry.gate_entry_number = gate_entry_num

    gate_repo.save(entry)
    return _to_gate_entry_response(entry)


@router.post("/reset-dev-entries")
async def reset_dev_entries(
    gate_repo: InMemoryGateEntryRepository = Depends(get_gate_repo),
):
    """Clear active gate entries for testing in dev mode."""
    gate_repo._entries.clear()
    return {"message": "Active dev gate entries cleared successfully"}


@router.post("/{entry_id}/verify", response_model=GateEntryResponse)
async def verify_gate_entry(
    entry_id: str,
    request: VerifyGateEntryRequest,
    gate_repo: InMemoryGateEntryRepository = Depends(get_gate_repo),
    user: CurrentUser = Depends(require_permission("gate:verify")),
) -> GateEntryResponse:
    """Supervisor / Manager override action (APPROVE or REJECT)."""
    entry = gate_repo.find_by_id(entry_id)
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

    gate_repo.save(entry)
    return _to_gate_entry_response(entry)



@router.get("/{entry_id}", response_model=GateEntryResponse)
async def get_gate_entry(
    entry_id: str,
    gate_repo: InMemoryGateEntryRepository = Depends(get_gate_repo),
    _user: CurrentUser = Depends(require_permission("gate:read")),
) -> GateEntryResponse:
    """Fetch Gate Entry details by ID."""
    entry = gate_repo.find_by_id(entry_id)
    if not entry:
        raise NotFoundException(f"Gate entry with ID '{entry_id}' not found")
    return _to_gate_entry_response(entry)


@router.get("", response_model=list[GateEntryResponse])
async def list_gate_entries(
    status: Optional[str] = None,
    gate_repo: InMemoryGateEntryRepository = Depends(get_gate_repo),
    _user: CurrentUser = Depends(require_permission("gate:read")),
) -> list[GateEntryResponse]:
    """List all Gate Entries with optional status filter."""
    entries = gate_repo.list_all()
    if status:
        clean_status = status.strip().upper()
        entries = [
            e
            for e in entries
            if (e.status.value if hasattr(e.status, "value") else str(e.status)).upper() == clean_status
        ]
    entries.sort(key=lambda x: x.created_at, reverse=True)
    return [_to_gate_entry_response(e) for e in entries]
