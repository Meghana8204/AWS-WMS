"""
Pydantic schemas for the Gate Entry REST API.
Inherits from ApiModel to serialize camelCase on the wire.
Purged mock fallbacks. Fully supports dynamic PO OCR extraction & persistent gate pass creation.
"""
from __future__ import annotations

from typing import Any, List, Optional
from pydantic import Field, model_validator

from app.common.api_model import ApiModel
from app.modules.gate.domain.value_objects import GateEntryStatus


class FieldMismatchDto(ApiModel):
    field_name: str
    extracted_value: Any
    canonical_value: Any


class OcrResultDto(ApiModel):
    po_number: str
    supplier_name: str
    material_description: str
    total_quantity: float
    po_date: str
    delivery_date: str
    confidence: float


class PurchaseOrderRecordDto(ApiModel):
    po_number: str
    supplier_name: str
    material_description: str
    total_quantity: float
    po_date: str
    delivery_date: str
    status: str = "OPEN"


class CreateCustomPoRequest(ApiModel):
    po_number: str = Field(..., min_length=1, description="Unique PO Number, e.g. PO-1001")
    supplier_name: str = Field(..., min_length=1, description="Supplier Name")
    material_description: str = Field(..., min_length=1, description="Material Description")
    total_quantity: float = Field(..., gt=0, description="Total Quantity")
    po_date: str = Field(..., min_length=1, description="PO Date (YYYY-MM-DD)")
    delivery_date: str = Field(..., min_length=1, description="Delivery Date (YYYY-MM-DD)")


class PoOcrPreviewRequest(ApiModel):
    document_image_base64: Optional[str] = Field(default=None, description="Base64 PO document image")
    po_number_override: Optional[str] = Field(default=None, description="Optional manual PO number override")

    @model_validator(mode="after")
    def require_input(self) -> "PoOcrPreviewRequest":
        if not self.document_image_base64 and not self.po_number_override:
            raise ValueError("Provide a PO document image or a PO number to preview OCR verification.")
        return self


class PoOcrPreviewResponse(ApiModel):
    ocr_result: OcrResultDto
    computed_status: str
    mismatched_fields: List[FieldMismatchDto] = Field(default_factory=list)
    po_record: Optional[PurchaseOrderRecordDto] = None


class CreateGateEntryRequest(ApiModel):
    vehicle_plate: str = Field(..., min_length=1, description="Mandatory manual vehicle license plate number")
    po_number: str = Field(..., min_length=1, description="Mandatory purchase order number")
    supplier_name: Optional[str] = Field(default=None, description="Extracted or input supplier name")
    material_description: Optional[str] = Field(default=None, description="Extracted or input material description")
    total_quantity: Optional[float] = Field(default=None, description="Extracted or input total quantity")
    driver_name: Optional[str] = Field(default="Driver", description="Driver Name")
    document_image_base64: Optional[str] = Field(default=None, description="Base64 encoded PO document image")
    truck_photo_base64: Optional[str] = Field(default=None, description="Base64 encoded captured truck photo")


class VerifyGateEntryRequest(ApiModel):
    action: str = Field(..., min_length=1, description="Mandatory action: APPROVE, REJECT, or UNSCHEDULED_ARRIVAL")
    remarks: str = Field(..., min_length=1, description="Mandatory supervisor remarks")
    reason: Optional[str] = Field(default=None, description="Optional approval, rejection, or transition reason")



class GateEntryResponse(ApiModel):
    id: str
    gate_entry_number: str
    vehicle_plate: str
    status: str
    created_by: str
    po_id: Optional[str] = None
    po_number: Optional[str] = None
    supplier_name: Optional[str] = None
    material_description: Optional[str] = None
    total_quantity: Optional[float] = None
    document_image_base64: Optional[str] = None
    truck_photo_base64: Optional[str] = None
    ocr_result: Optional[OcrResultDto] = None
    mismatched_fields: List[FieldMismatchDto] = Field(default_factory=list)
    verified_by: Optional[str] = None
    created_at: str
    updated_at: str
