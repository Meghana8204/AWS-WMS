"""
Value objects for the procurement domain.
Zero framework imports.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import uuid


@dataclass(frozen=True)
class PurchaseOrderId:
    value: uuid.UUID

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def generate(cls) -> "PurchaseOrderId":
        return cls(uuid.uuid4())

    @classmethod
    def of(cls, value: str | uuid.UUID) -> "PurchaseOrderId":
        if isinstance(value, uuid.UUID):
            return cls(value)
        return cls(uuid.UUID(value))


@dataclass(frozen=True)
class AttachmentCategory(str, Enum):
    QUOTATION = "QUOTATION"
    SUPPORTING_DOC = "SUPPORTING_DOC"
