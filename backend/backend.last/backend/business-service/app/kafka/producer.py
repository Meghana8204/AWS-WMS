"""
Kafka producer wrapper - the Python counterpart of
com.ams.common.outbox.EventDeliveryClient / HttpEventDeliveryClient.

This is deliberately the ONLY module that knows Kafka is how events leave
this service. Swapping the broker or wire format means touching this file
and nothing in domain/application code, exactly like the original design
intent documented in the Java HttpEventDeliveryClient docstring.
"""
from __future__ import annotations

from aiokafka import AIOKafkaProducer

from app.config.settings import get_settings
from app.logging.logger import get_logger

logger = get_logger(__name__)

_producer: AIOKafkaProducer | None = None


def _topic_for(event_type: str) -> str:
    settings = get_settings()
    # e.g. ams.goods-received, ams.return-requested
    slug = "".join(
        f"-{c.lower()}" if c.isupper() else c for c in event_type
    ).lstrip("-")
    return f"{settings.kafka_topic_prefix}.{slug}"


async def start_producer() -> None:
    global _producer
    settings = get_settings()
    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            client_id=settings.kafka_client_id,
            security_protocol=settings.kafka_security_protocol,
            enable_idempotence=True,
            acks="all",
        )
        await _producer.start()
        logger.info("Kafka producer started")
    except Exception as exc:
        _producer = None
        logger.warning(f"Kafka producer could not connect to {settings.kafka_bootstrap_servers}: {exc}. Outbox relay will retry when Kafka is up.")


async def stop_producer() -> None:
    global _producer
    if _producer is not None:
        try:
            await _producer.stop()
        except Exception:
            pass
        _producer = None
        logger.info("Kafka producer stopped")


async def publish(event_type: str, key: str, payload: bytes) -> None:
    if _producer is None:
        raise RuntimeError("Kafka producer not started - call start_producer() during app startup")
    topic = _topic_for(event_type)
    await _producer.send_and_wait(topic, value=payload, key=key.encode("utf-8"))
