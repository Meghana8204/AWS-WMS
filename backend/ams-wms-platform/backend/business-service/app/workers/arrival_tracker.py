"""
Worker / Background task for scheduled tracking of incoming ASN arrival dates.
Enforces multi-tier automated alerts:
- 5 Days before expected arrival: Alert to Warehouse Manager
- 3 Days before expected arrival: Alert to Warehouse Manager + Gate Security
- 0-2 Days before expected arrival: Daily Impending Arrival Notifications
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import session_scope
from app.events.outbox_repository import to_outbox_row
from app.logging.logger import get_logger
from app.modules.procurement.domain.arrival_notification import ArrivalNotification, ArrivalNotificationStatus
from app.modules.procurement.domain.events import ArrivalNotificationDispatchedEvent
from app.modules.procurement.domain.supplier_asn import ASNStatus
from app.modules.procurement.infrastructure.persistence.models import ArrivalNotificationModel, SupplierASNModel

logger = get_logger(__name__)


async def check_arrival_notifications_once() -> int:
    """
    Executes one pass of the arrival tracking alert scan.
    """
    async with session_scope() as session:
        return await process_arrival_alerts(session)


async def process_arrival_alerts(session: AsyncSession) -> int:
    today = date.today()
    stmt = select(SupplierASNModel).where(
        SupplierASNModel.status.in_([ASNStatus.SUBMITTED.value, ASNStatus.IN_TRANSIT.value])
    )
    result = await session.execute(stmt)
    asns: Sequence[SupplierASNModel] = result.scalars().all()

    alerts_generated = 0

    for asn in asns:
        days_until_arrival = (asn.expected_arrival_date - today).days

        recipients = []
        alert_type = None

        if days_until_arrival == 5:
            alert_type = "5_DAYS_NOTICE"
            recipients = ["Warehouse Manager"]
        elif days_until_arrival == 3:
            alert_type = "3_DAYS_NOTICE"
            recipients = ["Warehouse Manager", "Gate Security"]
        elif 0 <= days_until_arrival <= 2:
            alert_type = "DAILY_ARRIVAL_REMINDER"
            recipients = ["Warehouse Manager", "Gate Security", "Receiving Dock Supervisor"]

        if alert_type:
            # Check if alert for this ASN and alert_type was already dispatched today
            existing_stmt = select(ArrivalNotificationModel).where(
                ArrivalNotificationModel.asn_id == asn.id,
                ArrivalNotificationModel.warehouse_id == asn.warehouse_id,
            )
            existing_res = await session.execute(existing_stmt)
            existing_notes = existing_res.scalars().all()

            # Prevent duplicate notifications on the exact same date
            already_notified_today = any(
                n.created_at.date() == today for n in existing_notes
            )

            if not already_notified_today:
                notif = ArrivalNotificationModel(
                    id=f"AN-ALERT-{asn.id[-8:]}-{alert_type}-{today.strftime('%Y%m%d')}",
                    asn_id=asn.id,
                    asn_number=asn.asn_number,
                    po_id=asn.po_id,
                    po_number=asn.po_number,
                    warehouse_id=asn.warehouse_id,
                    supplier_name=asn.supplier_name,
                    vehicle_number=asn.vehicle_number,
                    expected_arrival_time=datetime.combine(asn.expected_arrival_date, datetime.min.time(), tzinfo=timezone.utc),
                    driver_phone=asn.driver_phone,
                    status=ArrivalNotificationStatus.DISPATCHED.value,
                )
                session.add(notif)

                # Add outbox event for Kafka dispatching to notification service
                event = ArrivalNotificationDispatchedEvent(
                    notification_id=notif.id,
                    asn_id=asn.id,
                    po_id=asn.po_id,
                    vehicle_number=asn.vehicle_number,
                    warehouse_id=asn.warehouse_id,
                )
                session.add(to_outbox_row("ArrivalNotification", notif.id, event))

                alerts_generated += 1
                logger.info(
                    f"Dispatched {alert_type} for ASN {asn.asn_number} (Vehicle {asn.vehicle_number}). Recipients: {recipients}"
                )

    return alerts_generated
