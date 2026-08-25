"""
Pydantic v2 request/response schemas - counterparts of ConfirmGrnRequest /
GrnResponse / GrnDetailResponse. Request-shape validation belongs here,
not in the domain layer.
"""
from __future__ import annotations

from decimal import Decimal

from app.common.api_model import ApiModel
from pydantic import Field, field_validator


class ConfirmGrnLineRequest(ApiModel):
    item_code: str = Field(min_length=1)
    quantity: Decimal

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_set(cls, v: Decimal) -> Decimal:
        if v is None:
            raise ValueError("quantity is required")
        return v


class ConfirmGrnRequest(ApiModel):
    po_id: str = Field(min_length=1)
    lines: list[ConfirmGrnLineRequest] = Field(min_length=1)


class GrnResponse(ApiModel):
    grn_id: str
    status: str


class GrnLineResponse(ApiModel):
    item_code: str
    received_quantity: Decimal
    ordered_quantity: Decimal | None


class GrnDetailResponse(ApiModel):
    grn_id: str
    po_id: str
    status: str
    lines: list[GrnLineResponse]
