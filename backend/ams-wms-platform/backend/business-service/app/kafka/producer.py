"""
Kafka producer wrapper - the Python counterpart of
com.ams.common.outbox.EventDeliveryClient / HttpEventDeliveryClient.

Fault-tolerant for local development: logs warning if Kafka is unreachable
instead of crashing application startup.
"""
from __future__ import annotations

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError

from app.config.settings import get_settings
from app.logging.logger import get_logger

logger = get_logger(__name__)

_producer: AIOKafkaProducer | None = None


def is_producer_active() -> bool:
    return _producer is not None


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
        producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            client_id=settings.kafka_client_id,
            security_protocol=settings.kafka_security_protocol,
            enable_idempotence=True,
            acks="all",
            request_timeout_ms=3000,
        )
        await producer.start()
        _producer = producer
        logger.info("Kafka producer started successfully")
    except Exception as exc:
        _producer = None
        logger.warning(
            f"Kafka broker unreachable at {settings.kafka_bootstrap_servers} ({exc}). Running in standalone mode without live Kafka producer."
        )


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
        logger.warning(f"Kafka producer inactive. Skipping live publishing of event '{event_type}' (key={key}).")
        return
    topic = _topic_for(event_type)
    try:
        await _producer.send_and_wait(topic, value=payload, key=key.encode("utf-8"))
    except Exception as exc:
        logger.error(f"Failed to publish event '{event_type}' to Kafka: {exc}")
