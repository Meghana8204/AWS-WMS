"""
Generic Kafka consumer runner used by background workers (see
app/workers/notification_consumer.py). Kept separate from the FastAPI
request path - consumers run as a long-lived background task or a
dedicated worker process (see docker-compose's `business-worker` service).
"""
from __future__ import annotations

from typing import Awaitable, Callable

from aiokafka import AIOKafkaConsumer

from app.config.settings import get_settings
from app.logging.logger import get_logger

logger = get_logger(__name__)


async def run_consumer(
    topics: list[str],
    group_id: str,
    handler: Callable[[str, bytes], Awaitable[None]],
) -> None:
    settings = get_settings()
    try:
        consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=group_id,
            security_protocol=settings.kafka_security_protocol,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
            request_timeout_ms=3000,
        )
        await consumer.start()
        logger.info("Kafka consumer started", extra={"extra_fields": {"topics": topics, "group_id": group_id}})
    except Exception as exc:
        logger.warning(f"Kafka consumer unreachable at {settings.kafka_bootstrap_servers} ({exc}). Background notification consumer disabled.")
        return

    try:
        async for message in consumer:
            await handler(message.topic, message.value)
            await consumer.commit()
    finally:
        await consumer.stop()
