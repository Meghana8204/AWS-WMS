"""
Domain service for Gate Verification rules, 6-field OCR comparison, and active duplicate detection.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from app.common.domain.exceptions import DomainRuleViolationException
from app.modules.gate.domain.aggregate import GateEntry
from app.modules.gate.domain.value_objects import (
    FieldMismatch,
    GateEntryStatus,
    OcrResult,
    PurchaseOrderRecord,
)


class GateVerificationService:
    @staticmethod
    def compare_ocr_against_po(
        ocr_result: OcrResult,
        po_record: Optional[PurchaseOrderRecord],
    ) -> Tuple[GateEntryStatus, List[FieldMismatch], Optional[str]]:
        """
        Executes 6-field automated matching between extracted OCR result and canonical database record.
        Fields compared:
          1. PO Number
          2. Supplier Name
          3. Material Description
          4. Total Quantity
          5. PO Date
          6. Delivery Date

        Returns:
          (GateEntryStatus, list of FieldMismatch, canonical_po_number)
        """
        # IF PO NOT FOUND -> UNSCHEDULED_ARRIVAL
        if po_record is None or not ocr_result.po_number:
            return (GateEntryStatus.UNSCHEDULED_ARRIVAL, [], None)

        mismatches: List[FieldMismatch] = []

        # Helper normalizers
        def norm_str(val: Optional[str]) -> str:
            return (val or "").strip().upper()

        def norm_num(val: Optional[float]) -> float:
            return float(val or 0.0)

        # 1. PO Number
        if norm_str(ocr_result.po_number) != norm_str(po_record.po_number):
            mismatches.append(
                FieldMismatch("po_number", ocr_result.po_number, po_record.po_number)
            )

        # 2. Supplier Name
        if norm_str(ocr_result.supplier_name) != norm_str(po_record.supplier_name):
            mismatches.append(
                FieldMismatch("supplier_name", ocr_result.supplier_name, po_record.supplier_name)
            )

        # 3. Material Description
        if norm_str(ocr_result.material_description) != norm_str(po_record.material_description):
            mismatches.append(
                FieldMismatch(
                    "material_description",
                    ocr_result.material_description,
                    po_record.material_description,
                )
            )

        # 4. Total Quantity
        if abs(norm_num(ocr_result.total_quantity) - norm_num(po_record.total_quantity)) > 1e-4:
            mismatches.append(
                FieldMismatch(
                    "total_quantity",
                    ocr_result.total_quantity,
                    po_record.total_quantity,
                )
            )

        # 5. PO Date
        if norm_str(ocr_result.po_date) != norm_str(po_record.po_date):
            mismatches.append(
                FieldMismatch("po_date", ocr_result.po_date, po_record.po_date)
            )

        # 6. Delivery Date
        if norm_str(ocr_result.delivery_date) != norm_str(po_record.delivery_date):
            mismatches.append(
                FieldMismatch(
                    "delivery_date", ocr_result.delivery_date, po_record.delivery_date
                )
            )

        if mismatches:
            return (
                GateEntryStatus.UNSCHEDULED_ARRIVAL,
                mismatches,
                po_record.po_number,
            )

        return (GateEntryStatus.PO_VERIFIED, [], po_record.po_number)

    @staticmethod
    def check_duplicate_active_entry(
        active_entries: List[GateEntry],
        po_number: Optional[str],
        vehicle_plate: Optional[str],
    ) -> None:
        """
        Active Duplicate Prevention: Detect active/open Gate Entry attempts for the same PO Number
        or Vehicle Plate.
        """
        non_terminal_statuses = {
            GateEntryStatus.PO_VERIFIED,
            GateEntryStatus.UNSCHEDULED_ARRIVAL,
        }


        for entry in active_entries:
            if entry.status in non_terminal_statuses:
                if vehicle_plate and entry.vehicle_plate.upper() == vehicle_plate.upper():
                    raise DomainRuleViolationException(
                        f"Active gate entry attempt ({entry.gate_entry_number}) already exists for vehicle plate '{vehicle_plate}'"
                    )
                if po_number and entry.po_number and entry.po_number.upper() == po_number.upper():
                    raise DomainRuleViolationException(
                        f"Active gate entry attempt ({entry.gate_entry_number}) already exists for PO number '{po_number}'"
                    )
