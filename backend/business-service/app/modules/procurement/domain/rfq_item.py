from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class RFQItem:
    material_code: str
    material_name: str
    category: str
    quantity: Decimal
    uom: str
    required_delivery_date: date
    warehouse: str
    special_requirements: str | None = None
