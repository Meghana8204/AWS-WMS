"""
PurchaseOrderItem domain entity representing a line item in Section 3: ORDER ITEMS.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import uuid


@dataclass
class PurchaseOrderItem:
    id: uuid.UUID
    material_code: str
    material_name: str | None = None
    category: str | None = None
    quantity: Decimal = Decimal("0.0")
    unit_price: Decimal = Decimal("0.0")

    @classmethod
    def create(
        cls,
        material_code: str,
        material_name: str | None = None,
        category: str | None = None,
        quantity: Decimal | str | float = Decimal("0.0"),
        unit_price: Decimal | str | float = Decimal("0.0"),
        item_id: uuid.UUID | None = None,
    ) -> "PurchaseOrderItem":
        qty = Decimal(str(quantity)) if not isinstance(quantity, Decimal) else quantity
        price = Decimal(str(unit_price)) if not isinstance(unit_price, Decimal) else unit_price
        return cls(
            id=item_id or uuid.uuid4(),
            material_code=material_code,
            material_name=material_name,
            category=category,
            quantity=qty,
            unit_price=price,
        )

    @property
    def line_total(self) -> Decimal:
        return self.quantity * self.unit_price
