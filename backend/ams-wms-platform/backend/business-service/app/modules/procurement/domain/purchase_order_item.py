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
    unit_of_measure: str = "PCS"
    quantity: Decimal = Decimal("0.0")
    unit_price: Decimal = Decimal("0.0")
    discount: Decimal = Decimal("0.0")
    tax: Decimal = Decimal("0.0")

    @classmethod
    def create(
        cls,
        material_code: str,
        material_name: str | None = None,
        category: str | None = None,
        unit_of_measure: str = "PCS",
        quantity: Decimal | str | float = Decimal("0.0"),
        unit_price: Decimal | str | float = Decimal("0.0"),
        discount: Decimal | str | float = Decimal("0.0"),
        tax: Decimal | str | float = Decimal("0.0"),
        item_id: uuid.UUID | None = None,
    ) -> "PurchaseOrderItem":
        qty = Decimal(str(quantity)) if not isinstance(quantity, Decimal) else quantity
        price = Decimal(str(unit_price)) if not isinstance(unit_price, Decimal) else unit_price
        disc = Decimal(str(discount)) if not isinstance(discount, Decimal) else discount
        tax_val = Decimal(str(tax)) if not isinstance(tax, Decimal) else tax
        return cls(
            id=item_id or uuid.uuid4(),
            material_code=material_code,
            material_name=material_name,
            category=category,
            unit_of_measure=unit_of_measure,
            quantity=qty,
            unit_price=price,
            discount=disc,
            tax=tax_val,
        )

    @property
    def gross_amount(self) -> Decimal:
        return self.quantity * self.unit_price

    @property
    def line_subtotal(self) -> Decimal:
        return self.gross_amount - self.discount

    @property
    def line_total(self) -> Decimal:
        return self.line_subtotal + self.tax
