"""
Outbox relay - counterpart of com.ams.common.outbox.OutboxRelay.

Polls this service's own outbox table on a fixed interval and hands
undelivered rows to the Kafka producer. This job never changes when the
delivery mechanism changes (HTTP webhook -> Kafka already happened as part
of this migration); only app/kafka/producer.py would need to change again.
Registered as an APScheduler interval job from app/main.py's lifespan.
"""
from __future__ import annotations

from app.config.settings import get_settings
from app.database.session import session_scope
from app.events.outbox_repository import fetch_undelivered, mark_delivered
from app.kafka.producer import publish
from app.logging.logger import get_logger

logger = get_logger(__name__)


async def relay_once() -> None:
    settings = get_settings()
    try:
        async with session_scope() as session:
            pending = await fetch_undelivered(session, limit=settings.outbox_batch_size)
            if not pending:
                return
            delivered_ids = []
            for row in pending:
                try:
                    await publish(row.event_type, key=row.aggregate_id, payload=row.payload.encode("utf-8"))
                    delivered_ids.append(row.id)
                except Exception:
                    logger.exception(
                        "Failed to deliver outbox event; will retry next poll",
                        extra={"extra_fields": {"outbox_id": str(row.id), "event_type": row.event_type}},
                    )
            await mark_delivered(session, delivered_ids)
            if delivered_ids:
                logger.info("Relayed outbox events", extra={"extra_fields": {"count": len(delivered_ids)}})
    except Exception as exc:
        logger.debug(f"Outbox relay poll skipped: {exc}")
