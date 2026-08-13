"""
Arrival Notification Domain Model.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid


class ArrivalNotificationStatus(str, Enum):
    PENDING = "PENDING"
    DISPATCHED = "DISPATCHED"
    ACKNOWLEDGED = "ACKNOWLEDGED"


@dataclass
class ArrivalNotification:
    id: str
    asn_id: str
    asn_number: str
    po_id: str
    po_number: str
    warehouse_id: str
    supplier_name: str
    vehicle_number: str
    expected_arrival_time: datetime
    driver_phone: str | None = None
    status: ArrivalNotificationStatus = ArrivalNotificationStatus.PENDING
    notified_recipients: list[str] = field(default_factory=lambda: ["Gate Security", "Receiving Dock Manager"])
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def create(
        cls,
        asn_id: str,
        asn_number: str,
        po_id: str,
        po_number: str,
        warehouse_id: str,
        supplier_name: str,
        vehicle_number: str,
        expected_arrival_time: datetime,
        driver_phone: str | None = None,
        notification_id: str | None = None,
    ) -> "ArrivalNotification":
        return cls(
            id=notification_id or f"AN-{uuid.uuid4().hex[:8].upper()}",
            asn_id=asn_id,
            asn_number=asn_number,
            po_id=po_id,
            po_number=po_number,
            warehouse_id=warehouse_id,
            supplier_name=supplier_name,
            vehicle_number=vehicle_number,
            expected_arrival_time=expected_arrival_time,
            driver_phone=driver_phone,
            status=ArrivalNotificationStatus.PENDING,
        )

    def dispatch(self) -> None:
        self.status = ArrivalNotificationStatus.DISPATCHED
        self.updated_at = datetime.now(timezone.utc)
