"""
Domain verification service for Gate Entry module.
Implements comparison logic between OCR results, ANPR results, and DB Purchase Orders.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from app.modules.gate.domain.enums import GateEntryStatus, MismatchField, VerificationResultType
from app.modules.gate.domain.value_objects import AnprResult, OcrResult, VerificationResult


@dataclass
class PurchaseOrderDetails:
    po_id: str
    po_number: str
    supplier_name: str | None = None
    product_material: str | None = None
    total_quantity: Decimal | None = None
    po_date: date | None = None
    expected_delivery_date: date | None = None


class GateEntryVerificationDomainService:
    def __init__(self, anpr_confidence_threshold: float = 0.85) -> None:
        self.anpr_confidence_threshold = anpr_confidence_threshold

    def verify(
        self,
        vehicle_number: str,
        anpr_result: AnprResult | None,
        ocr_result: OcrResult | None,
        po_details: PurchaseOrderDetails | None,
    ) -> VerificationResult:
        mismatched_fields: list[MismatchField] = []
        reasons: list[str] = []

        # 1. Check ANPR confidence & vehicle number match
        low_anpr_confidence = False
        if anpr_result is None:
            reasons.append("ANPR recognition failed or camera image unavailable")
            low_anpr_confidence = True
        else:
            if not anpr_result.is_high_confidence(self.anpr_confidence_threshold):
                reasons.append(
                    f"ANPR confidence ({anpr_result.confidence:.2f}) is below required threshold ({self.anpr_confidence_threshold:.2f})"
                )
                low_anpr_confidence = True

            # Normalize vehicle numbers for comparison
            normalized_expected = "".join(c.upper() for c in vehicle_number if c.isalnum())
            normalized_detected = "".join(c.upper() for c in anpr_result.detected_vehicle_number if c.isalnum())
            if normalized_expected and normalized_detected and normalized_expected != normalized_detected:
                reasons.append(
                    f"Vehicle plate mismatch: expected '{vehicle_number}', detected '{anpr_result.detected_vehicle_number}'"
                )
                low_anpr_confidence = True

        # 2. Check Purchase Order existence
        if po_details is None:
            reasons.append("Purchase Order not found in system database")
            mismatched_fields.append(MismatchField.PO_NUMBER)
            return VerificationResult(
                status=GateEntryStatus.UNSCHEDULED_ARRIVAL,
                verification_type=VerificationResultType.UNSCHEDULED_PO,
                mismatched_fields=mismatched_fields,
                reasons=reasons,
            )

        # 3. Check OCR processing
        if ocr_result is None or not ocr_result.po_number:
            reasons.append("OCR processing failed or unreadable Purchase Order document")
            return VerificationResult(
                status=GateEntryStatus.MANUAL_VERIFICATION_REQUIRED,
                verification_type=VerificationResultType.FAILED_OCR,
                mismatched_fields=[MismatchField.PO_NUMBER],
                reasons=reasons,
            )

        # 4. Compare PO Number
        if ocr_result.po_number.strip().upper() != po_details.po_number.strip().upper():
            mismatched_fields.append(MismatchField.PO_NUMBER)
            reasons.append(f"PO Number mismatch: OCR '{ocr_result.po_number}' vs DB '{po_details.po_number}'")

        # 5. Compare Supplier Name if available
        if ocr_result.supplier_name and po_details.supplier_name:
            if ocr_result.supplier_name.strip().lower() != po_details.supplier_name.strip().lower():
                mismatched_fields.append(MismatchField.SUPPLIER_NAME)
                reasons.append(f"Supplier Name mismatch: OCR '{ocr_result.supplier_name}' vs DB '{po_details.supplier_name}'")

        # 6. Compare Product/Material if available
        if ocr_result.product_material and po_details.product_material:
            if ocr_result.product_material.strip().lower() != po_details.product_material.strip().lower():
                mismatched_fields.append(MismatchField.PRODUCT_MATERIAL)
                reasons.append(
                    f"Product/Material mismatch: OCR '{ocr_result.product_material}' vs DB '{po_details.product_material}'"
                )

        # 7. Compare Quantity if available
        if ocr_result.quantity is not None and po_details.total_quantity is not None:
            if abs(ocr_result.quantity - po_details.total_quantity) > Decimal("0.001"):
                mismatched_fields.append(MismatchField.QUANTITY)
                reasons.append(f"Quantity mismatch: OCR {ocr_result.quantity} vs DB {po_details.total_quantity}")

        # 8. Compare PO Date if available
        if ocr_result.po_date and po_details.po_date:
            if ocr_result.po_date != po_details.po_date:
                mismatched_fields.append(MismatchField.PO_DATE)
                reasons.append(f"PO Date mismatch: OCR {ocr_result.po_date} vs DB {po_details.po_date}")

        # 9. Compare Expected Delivery Date if available
        if ocr_result.expected_delivery_date and po_details.expected_delivery_date:
            if ocr_result.expected_delivery_date != po_details.expected_delivery_date:
                mismatched_fields.append(MismatchField.EXPECTED_DELIVERY_DATE)
                reasons.append(
                    f"Expected Delivery Date mismatch: OCR {ocr_result.expected_delivery_date} vs DB {po_details.expected_delivery_date}"
                )

        # Final decision logic
        if mismatched_fields or low_anpr_confidence:
            v_type = VerificationResultType.MISMATCHED if mismatched_fields else VerificationResultType.LOW_ANPR_CONFIDENCE
            return VerificationResult(
                status=GateEntryStatus.MANUAL_VERIFICATION_REQUIRED,
                verification_type=v_type,
                mismatched_fields=mismatched_fields,
                reasons=reasons,
            )

        return VerificationResult(
            status=GateEntryStatus.PO_VERIFIED,
            verification_type=VerificationResultType.MATCHED,
            mismatched_fields=[],
            reasons=["All Purchase Order and ANPR checks matched successfully"],
        )
