"""
Pydantic v2 request/response schemas for the Goods Receiving / GRN module.

This file keeps the original ConfirmGrn* schemas for backward compatibility
and adds the page-wise schemas required for the extended GRN workflow:

1. GRN header / PO context
2. Item receiving
3. Damage evidence
4. Quality inspection
5. Batch creation
6. Batch QR
7. Documents
8. GRN completion
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.common.api_model import ApiModel


# ============================================================================
# COMMON TYPES
# ============================================================================

ReceiptType = Literal["PO_RECEIPT", "UNEXPECTED_DELIVERY"]

GrnStatus = Literal[
    "DRAFT",
    "PARTIALLY_COMPLETED",
    "RECEIVING_COMPLETE",
    "COMPLETED",
]

NonNegativeQuantity = Annotated[
    Decimal,
    Field(ge=Decimal("0")),
]

PositiveQuantity = Annotated[
    Decimal,
    Field(gt=Decimal("0")),
]


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    value = value.strip()
    return value or None


# ============================================================================
# LEGACY / EXISTING CONFIRM-GRN API
#
# Keep these classes because the existing receiving router/use-case can
# already import and use them.
# ============================================================================

class ConfirmGrnLineRequest(ApiModel):
    item_code: str = Field(min_length=1, max_length=64)
    quantity: PositiveQuantity

    @field_validator("item_code")
    @classmethod
    def clean_item_code(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("item_code is required")

        return value


class ConfirmGrnRequest(ApiModel):
    po_id: str = Field(min_length=1)
    lines: list[ConfirmGrnLineRequest] = Field(min_length=1)


class GrnResponse(ApiModel):
    grn_id: str
    status: str


# ============================================================================
# PAGE 1 - GRN HEADER / PO CONTEXT
# ============================================================================

class DockOptionResponse(ApiModel):
    dock_number: str
    warehouse_id: str
    dock_type: str | None = None
    capacity: int | None = None
    status: str | None = None


class GrnContextLineResponse(ApiModel):
    item_code: str
    material_name: str | None = None
    material_category: str | None = None
    uom: str | None = None

    ordered_quantity: Decimal | None = None
    received_quantity: Decimal = Decimal("0")
    good_quantity: Decimal = Decimal("0")
    damaged_quantity: Decimal = Decimal("0")
    rejected_quantity: Decimal = Decimal("0")
    quality_approved_quantity: Decimal = Decimal("0")
    balance_quantity: Decimal = Decimal("0")


class GrnContextResponse(ApiModel):
    """
    Information returned after the user enters/selects a PO.

    For PO_RECEIPT, supplier/ASN/gate/vehicle information should normally
    be populated by the backend from existing records.

    receiving_dock is intentionally NOT auto-copied from Gate Entry.
    The UI should load dock_options and let the receiving user choose one.
    """

    receipt_type: ReceiptType = "PO_RECEIPT"

    po_id: str | None = None
    po_number: str | None = None

    grn_id: str | None = None
    grn_number: str | None = None
    grn_status: str | None = None

    asn_id: str | None = None
    asn_number: str | None = None

    gate_entry_id: str | None = None
    gate_entry_number: str | None = None

    supplier_name: str | None = None
    supplier_company_name: str | None = None

    warehouse_id: str | None = None
    warehouse_name: str | None = None

    vehicle_number: str | None = None
    driver_name: str | None = None
    invoice_number: str | None = None

    received_by: str | None = None

    dock_options: list[DockOptionResponse] = Field(default_factory=list)
    prefilled_dock_number: str | None = None
    field_sources: dict | None = None
    lines: list[GrnContextLineResponse] = Field(default_factory=list)


class CreateGrnHeaderRequest(ApiModel):
    """
    Saves/creates the GRN header.

    grn_number and received_by are deliberately absent:
    - grn_number must be generated/reused by the backend.
    - received_by must come from the authenticated user.

    For PO_RECEIPT, the backend should treat supplier/ASN/gate/vehicle
    values as authoritative from the existing PO/ASN/Gate data.

    For UNEXPECTED_DELIVERY, the optional manual fields can be used.
    """

    receipt_type: ReceiptType = "PO_RECEIPT"

    po_id: str | None = None
    po_number: str | None = Field(default=None, max_length=64)

    # Manual receiving dock selected on the GRN page.
    dock_number: str = Field(min_length=1, max_length=32)

    invoice_number: str | None = Field(default=None, max_length=128)

    # Manual/fallback values, especially for unexpected deliveries.
    supplier_name: str | None = Field(default=None, max_length=255)
    supplier_company_name: str | None = Field(default=None, max_length=255)
    warehouse_id: str | None = Field(default=None, max_length=64)
    warehouse_name: str | None = Field(default=None, max_length=255)
    vehicle_number: str | None = Field(default=None, max_length=64)
    driver_name: str | None = Field(default=None, max_length=128)

    verification_notes: str | None = None

    @field_validator(
        "po_id",
        "po_number",
        "invoice_number",
        "supplier_name",
        "supplier_company_name",
        "warehouse_id",
        "warehouse_name",
        "vehicle_number",
        "driver_name",
        "verification_notes",
    )
    @classmethod
    def clean_optional_fields(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("dock_number")
    @classmethod
    def clean_dock_number(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("dock_number is required")

        return value


class GrnHeaderResponse(ApiModel):
    grn_id: str
    grn_number: str | None = None

    receipt_type: str
    status: str

    po_id: str | None = None
    po_number: str | None = None

    asn_id: str | None = None
    asn_number: str | None = None

    gate_entry_id: str | None = None
    gate_entry_number: str | None = None

    supplier_name: str | None = None
    supplier_company_name: str | None = None

    warehouse_id: str | None = None
    warehouse_name: str | None = None
    dock_number: str | None = None

    vehicle_number: str | None = None
    driver_name: str | None = None
    invoice_number: str | None = None

    receipt_date: datetime | None = None
    received_by: str | None = None

    verification_notes: str | None = None

    created_at: datetime | None = None
    updated_at: datetime | None = None


# ============================================================================
# PAGE 2 - ITEM RECEIVING DETAILS
# ============================================================================

class GrnLineReceivingRequest(ApiModel):
    """
    Quantity values submitted for one GRN material line.

    Business rules such as:
        received = good + damaged
        balance = ordered - cumulative received
    should be calculated/validated centrally in the application/use-case
    layer, not trusted from the frontend.
    """

    item_code: str = Field(min_length=1, max_length=64)

    good_quantity: NonNegativeQuantity = Decimal("0")
    damaged_quantity: NonNegativeQuantity = Decimal("0")

    @field_validator("item_code")
    @classmethod
    def clean_item_code(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("item_code is required")

        return value


class UpdateGrnLinesRequest(ApiModel):
    lines: list[GrnLineReceivingRequest] = Field(min_length=1)


class GrnLineResponse(ApiModel):
    grn_line_id: str | None = None
    item_code: str

    material_name: str | None = None
    material_category: str | None = None
    uom: str | None = None

    ordered_quantity: Decimal | None = None
    received_quantity: Decimal = Decimal("0")

    good_quantity: Decimal = Decimal("0")
    damaged_quantity: Decimal = Decimal("0")

    accepted_quantity: Decimal | None = None
    rejected_quantity: Decimal = Decimal("0")
    quality_approved_quantity: Decimal = Decimal("0")

    balance_quantity: Decimal = Decimal("0")
    quality_result: str | None = None


class UpdateGrnLinesResponse(ApiModel):
    grn_id: str
    grn_number: str | None = None
    status: str
    lines: list[GrnLineResponse]


# ============================================================================
# PAGE 3 - DAMAGE EVIDENCE
# ============================================================================

class DamageEvidenceMetadataRequest(ApiModel):
    """
    Metadata accompanying an uploaded damage image/file.

    The binary file itself should be handled by FastAPI UploadFile.
    file_path must be generated by the backend after securely storing
    the upload; the client should not provide arbitrary server paths.
    """

    damaged_quantity: PositiveQuantity
    reason: str | None = Field(default=None, max_length=1000)
    remarks: str | None = Field(default=None, max_length=2000)

    @field_validator("reason", "remarks")
    @classmethod
    def clean_optional_fields(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)


class DamageEvidenceResponse(ApiModel):
    evidence_id: str
    grn_line_id: str

    damaged_quantity: Decimal
    reason: str | None = None
    remarks: str | None = None

    file_name: str
    file_path: str

    uploaded_by: str
    uploaded_at: datetime


# ============================================================================
# PAGE 4 - QUALITY INSPECTION
# ============================================================================

class QualityInspectionLineRequest(ApiModel):
    """
    Keep quality_result as a string for compatibility with the project's
    existing receiving/quality logic. The application service should define
    the allowed decisions in one central place.
    """

    grn_line_id: str = Field(min_length=1)
    quality_result: str = Field(min_length=1, max_length=32)

    accepted_quantity: NonNegativeQuantity = Decimal("0")
    rejected_quantity: NonNegativeQuantity = Decimal("0")
    quality_approved_quantity: NonNegativeQuantity = Decimal("0")

    @field_validator("quality_result")
    @classmethod
    def normalize_quality_result(cls, value: str) -> str:
        value = value.strip().upper()

        if not value:
            raise ValueError("quality_result is required")

        return value


class QualityInspectionRequest(ApiModel):
    lines: list[QualityInspectionLineRequest] = Field(min_length=1)


class QualityInspectionLineResponse(ApiModel):
    grn_line_id: str
    item_code: str

    quality_result: str
    accepted_quantity: Decimal | None = None
    rejected_quantity: Decimal
    quality_approved_quantity: Decimal


class QualityInspectionResponse(ApiModel):
    grn_id: str
    status: str
    lines: list[QualityInspectionLineResponse]


# ============================================================================
# PAGE 5 - BATCH CREATION
# ============================================================================

class BatchQuantityRequest(ApiModel):
    """
    Client provides only the quantity.

    batch_number should be generated by the backend/database-safe service
    so concurrent users cannot generate duplicate batch numbers.
    """

    batch_quantity: PositiveQuantity


class CreateGrnBatchesRequest(ApiModel):
    grn_line_id: str = Field(min_length=1)
    batches: list[BatchQuantityRequest] = Field(min_length=1)


class GrnBatchResponse(ApiModel):
    batch_id: str
    grn_line_id: str
    batch_number: str
    batch_quantity: Decimal

    created_by: str
    created_at: datetime


# ============================================================================
# PAGE 6 - BATCH QR
# ============================================================================

class GrnBatchQrResponse(ApiModel):
    qr_id: str
    batch_id: str
    qr_code: str
    qr_payload: str
    generated_at: datetime


class BatchWithQrResponse(ApiModel):
    batch: GrnBatchResponse
    qr: GrnBatchQrResponse | None = None


# ============================================================================
# PAGE 7 - DOCUMENTS
# ============================================================================

class GrnDocumentMetadataRequest(ApiModel):
    """
    Metadata accompanying UploadFile.

    file_name/file_path/uploaded_by are populated by the backend.
    """

    document_type: str = Field(min_length=1, max_length=64)

    @field_validator("document_type")
    @classmethod
    def normalize_document_type(cls, value: str) -> str:
        value = value.strip().upper()

        if not value:
            raise ValueError("document_type is required")

        return value


class GrnDocumentResponse(ApiModel):
    document_id: str
    grn_id: str

    document_type: str
    file_name: str
    file_path: str

    uploaded_by: str
    uploaded_at: datetime


# ============================================================================
# PAGE 8 - COMPLETE GRN
# ============================================================================

class CompleteGrnRequest(ApiModel):
    verification_notes: str | None = Field(default=None, max_length=4000)

    @field_validator("verification_notes")
    @classmethod
    def clean_notes(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)


class CompleteGrnResponse(ApiModel):
    grn_id: str
    grn_number: str | None = None

    status: str

    posted_by: str | None = None
    posted_at: datetime | None = None

    message: str | None = None


# ============================================================================
# COMPLETE GRN DETAIL RESPONSE
# ============================================================================

class GrnDetailResponse(ApiModel):
    grn_id: str

    grn_number: str | None = None
    status: str
    receipt_type: str = "PO_RECEIPT"

    po_id: str | None = None
    po_number: str | None = None

    asn_id: str | None = None
    asn_number: str | None = None

    gate_entry_id: str | None = None
    gate_entry_number: str | None = None

    supplier_name: str | None = None
    supplier_company_name: str | None = None

    warehouse_id: str | None = None
    warehouse_name: str | None = None
    dock_number: str | None = None

    vehicle_number: str | None = None
    driver_name: str | None = None
    invoice_number: str | None = None

    receipt_date: datetime | None = None
    received_by: str | None = None

    posted_by: str | None = None
    posted_at: datetime | None = None

    verification_notes: str | None = None

    created_at: datetime | None = None
    updated_at: datetime | None = None

    lines: list[GrnLineResponse] = Field(default_factory=list)
    documents: list[GrnDocumentResponse] = Field(default_factory=list)


# ============================================================================
# OPTIONAL LIST / SUMMARY RESPONSES
# ============================================================================

class GrnSummaryResponse(ApiModel):
    grn_id: str
    grn_number: str | None = None

    po_number: str | None = None
    supplier_name: str | None = None

    receipt_type: str
    status: str

    warehouse_name: str | None = None
    dock_number: str | None = None

    receipt_date: datetime | None = None
    received_by: str | None = None


class GrnListResponse(ApiModel):
    items: list[GrnSummaryResponse] = Field(default_factory=list)
    total: int = 0
