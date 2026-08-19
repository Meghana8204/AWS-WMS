"""
ConfirmGrnCommand - counterpart of ConfirmGrnCommand.java. Plain,
immutable input to the use case; no framework/validation concerns here
(request-shape validation happens in infrastructure/api/schemas.py via
Pydantic, then gets translated into this command).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ConfirmGrnLine:
    item_code: str
    quantity: Decimal


@dataclass(frozen=True)
class ConfirmGrnCommand:
    po_id: str
    lines: list[ConfirmGrnLine]
