"""
GrnId / PurchaseOrderId - counterparts of the Java GrnId / PurchaseOrderId
value objects. UUID-backed, immutable, equality by value. Supports flexible string PO formats.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class GrnId:
    value: uuid.UUID

    @staticmethod
    def new_id() -> "GrnId":
        return GrnId(uuid.uuid4())

    @staticmethod
    def of(value: str | uuid.UUID) -> "GrnId":
        if isinstance(value, uuid.UUID):
            return GrnId(value)
        try:
            return GrnId(uuid.UUID(value))
        except ValueError:
            return GrnId(uuid.uuid5(uuid.NAMESPACE_DNS, str(value)))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class PurchaseOrderId:
    value: uuid.UUID

    @staticmethod
    def of(value: str | uuid.UUID) -> "PurchaseOrderId":
        if isinstance(value, uuid.UUID):
            return PurchaseOrderId(value)
        try:
            return PurchaseOrderId(uuid.UUID(value))
        except ValueError:
            return PurchaseOrderId(uuid.uuid5(uuid.NAMESPACE_DNS, str(value)))

    def __str__(self) -> str:
        return str(self.value)
