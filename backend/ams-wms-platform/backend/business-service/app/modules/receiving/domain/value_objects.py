"""
GrnId / PurchaseOrderId - counterparts of the Java GrnId / PurchaseOrderId
value objects. UUID-backed, immutable, equality by value.
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
        return GrnId(value if isinstance(value, uuid.UUID) else uuid.UUID(value))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class PurchaseOrderId:
    value: uuid.UUID

    @staticmethod
    def of(value: str | uuid.UUID) -> "PurchaseOrderId":
        return PurchaseOrderId(value if isinstance(value, uuid.UUID) else uuid.UUID(value))

    def __str__(self) -> str:
        return str(self.value)
