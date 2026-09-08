"""
Application commands / queries for the Goods Receiving / GRN module.

Important:
- These are plain immutable application-layer inputs.
- Pydantic/FastAPI validation belongs in infrastructure/api/schemas.py.
- Database/ASN/PO lookups belong in repository/use-case code.
- For PO_RECEIPT, ASN, Gate Entry, vehicle and driver details must be
  resolved by the backend from existing records; the frontend must not
  be treated as the source of truth for those fields.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


# ============================================================================
# LEGACY CONFIRM-GRN COMMAND
#
# Keep this because the existing receiving API/use-case may already import it.
# ============================================================================

@dataclass(frozen=True)
class ConfirmGrnLine:
    item_code: str
    quantity: Decimal


@dataclass(frozen=True)
class ConfirmGrnCommand:
    po_id: str
    lines: list[ConfirmGrnLine]


# ============================================================================
# PAGE 1 - LOAD PO / ASN / GATE CONTEXT
# ============================================================================

@dataclass(frozen=True)
class GetGrnContextQuery:
    """
    Load the receiving context before creating/updating the GRN.
    """

    po_id: str | None = None
    po_number: str | None = None
    gate_entry_id: str | None = None


# ============================================================================
# PAGE 1 - CREATE / UPDATE GRN HEADER
# ============================================================================

@dataclass(frozen=True)
class CreateOrUpdateGrnHeaderCommand:
    """
    Header information supplied to the GRN application service.

    received_by is injected by the API layer from the authenticated user.

    For PO_RECEIPT:
    - po_id / po_number identify the order.
    - supplier/warehouse/vehicle/driver information should be reloaded by
      the use case from PO/ASN/Gate data instead of trusting client values.
    - dock_number is intentionally selected manually on the GRN screen.

    For UNEXPECTED_DELIVERY:
    - PO/ASN/Gate references can be absent.
    - manual supplier/warehouse/vehicle/driver values can be used.
    """

    receipt_type: str
    dock_number: str
    received_by: str

    po_id: str | None = None
    po_number: str | None = None

    invoice_number: str | None = None

    supplier_name: str | None = None
    supplier_company_name: str | None = None

    warehouse_id: str | None = None
    warehouse_name: str | None = None

    vehicle_number: str | None = None
    driver_name: str | None = None

    verification_notes: str | None = None


# ============================================================================
# PAGE 2 - ITEM RECEIVING
# ============================================================================

@dataclass(frozen=True)
class ReceiveGrnLine:
    item_code: str
    good_quantity: Decimal
    damaged_quantity: Decimal


@dataclass(frozen=True)
class UpdateGrnLinesCommand:
    grn_id: str
    received_by: str
    lines: list[ReceiveGrnLine]


# ============================================================================
# PAGE 3 - DAMAGE EVIDENCE
# ============================================================================

@dataclass(frozen=True)
class AddDamageEvidenceCommand:
    """
    file_name/file_path are supplied only after the infrastructure layer has
    securely stored the uploaded file.

    uploaded_by is the authenticated user.
    """

    grn_id: str
    grn_line_id: str
    damaged_quantity: Decimal

    file_name: str
    file_path: str
    uploaded_by: str

    reason: str | None = None
    remarks: str | None = None


# ============================================================================
# PAGE 4 - QUALITY INSPECTION
# ============================================================================

@dataclass(frozen=True)
class InspectGrnLine:
    grn_line_id: str
    quality_result: str

    accepted_quantity: Decimal
    rejected_quantity: Decimal
    quality_approved_quantity: Decimal


@dataclass(frozen=True)
class RecordQualityInspectionCommand:
    grn_id: str
    inspected_by: str
    lines: list[InspectGrnLine]


# ============================================================================
# PAGE 5 - BATCH CREATION
# ============================================================================

@dataclass(frozen=True)
class BatchQuantity:
    batch_quantity: Decimal


@dataclass(frozen=True)
class CreateGrnBatchesCommand:
    """
    batch_number is deliberately not supplied by the client.

    The application/repository layer should generate a unique batch number
    in a concurrency-safe way.
    """

    grn_id: str
    grn_line_id: str
    created_by: str
    batches: list[BatchQuantity]


# ============================================================================
# PAGE 6 - QR GENERATION
# ============================================================================

@dataclass(frozen=True)
class GenerateBatchQrCommand:
    """
    The service should build qr_code / qr_payload from authoritative
    server-side batch/GRN data rather than accepting arbitrary QR payload
    content from the frontend.
    """

    grn_id: str
    batch_id: str
    generated_by: str


# ============================================================================
# PAGE 7 - DOCUMENT UPLOAD
# ============================================================================

@dataclass(frozen=True)
class AddGrnDocumentCommand:
    """
    file_name/file_path are supplied after secure file storage.

    uploaded_by comes from the authenticated user.
    """

    grn_id: str
    document_type: str

    file_name: str
    file_path: str

    uploaded_by: str


# ============================================================================
# PAGE 8 - COMPLETE GRN
# ============================================================================

@dataclass(frozen=True)
class CompleteGrnCommand:
    """
    Final completion command.

    The use case must verify, before COMPLETED:
    - all receiving quantities are valid
    - damage evidence requirements are satisfied
    - quality inspection is complete
    - batch totals equal quality-approved quantities
    - required documents are present
    - the one-PO-one-GRN rule is still satisfied
    """

    grn_id: str
    completed_by: str
    verification_notes: str | None = None
