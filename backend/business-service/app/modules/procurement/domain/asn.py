from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List

from app.common.domain.aggregate_root import AggregateRoot
from app.common.domain.events import DomainEvent
from app.modules.procurement.domain.events import AsnCreatedEvent
from app.modules.procurement.domain.value_objects import AsnId, PurchaseOrderId


@dataclass
class AsnLine:
    item_code: str
    shipped_quantity: Decimal


class ASN(AggregateRoot):
    def __init__(
        self,
        id: AsnId,
        po_id: PurchaseOrderId,
        asn_number: str,
        status: str,
        lines: List[AsnLine],
        vehicle_number: str | None = None,
        driver_name: str | None = None,
        driver_contact: str | None = None,
        expected_arrival_at: datetime | None = None,
        shipment_date: date | None = None,
        created_at: datetime | None = None,
    ) -> None:
        super().__init__()
        self.id = id
        self.po_id = po_id
        self.asn_number = asn_number
        self.status = status
        self.lines = lines
        self.vehicle_number = vehicle_number
        self.driver_name = driver_name
        self.driver_contact = driver_contact
        self.expected_arrival_at = expected_arrival_at
        self.shipment_date = shipment_date or date.today()
        self.created_at = created_at or datetime.now()

    @staticmethod
    def create(
        po_id: PurchaseOrderId,
        asn_number: str,
        lines: List[AsnLine],
        vehicle_number: str | None = None,
        expected_arrival_at: datetime | None = None,
        shipment_date: date | None = None,
    ) -> ASN:
        asn = ASN(
            id=AsnId.new_id(),
            po_id=po_id,
            asn_number=asn_number,
            status="SHIPPED",
            lines=lines,
            vehicle_number=vehicle_number,
            expected_arrival_at=expected_arrival_at,
            shipment_date=shipment_date,
        )
        asn._register_event(
            AsnCreatedEvent(
                asn_id=str(asn.id),
                asn_number=asn.asn_number,
                po_id=str(asn.po_id),
                occurred_at=DomainEvent.now(),
            )
        )
        return asn
