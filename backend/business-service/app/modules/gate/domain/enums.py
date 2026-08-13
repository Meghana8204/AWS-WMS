"""
Domain Enums for the Gate Entry module.
"""
from enum import Enum


class GateEntryStatus(str, Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    PO_VERIFIED = "PO_VERIFIED"
    MANUAL_VERIFICATION_REQUIRED = "MANUAL_VERIFICATION_REQUIRED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    UNSCHEDULED_ARRIVAL = "UNSCHEDULED_ARRIVAL"


class MismatchField(str, Enum):
    PO_NUMBER = "po_number"
    SUPPLIER_NAME = "supplier_name"
    PRODUCT_MATERIAL = "product_material"
    QUANTITY = "quantity"
    PO_DATE = "po_date"
    EXPECTED_DELIVERY_DATE = "expected_delivery_date"


class VerificationResultType(str, Enum):
    MATCHED = "MATCHED"
    MISMATCHED = "MISMATCHED"
    LOW_ANPR_CONFIDENCE = "LOW_ANPR_CONFIDENCE"
    UNSCHEDULED_PO = "UNSCHEDULED_PO"
    FAILED_OCR = "FAILED_OCR"
    FAILED_ANPR = "FAILED_ANPR"
