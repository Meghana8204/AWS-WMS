"""
Outbox relay - counterpart of com.ams.common.outbox.OutboxRelay.
"""
from __future__ import annotations

from app.config.settings import get_settings
from app.database.session import session_scope
from app.events.outbox_repository import fetch_undelivered, mark_delivered
from app.kafka.producer import publish, is_producer_available
from app.logging.logger import get_logger

logger = get_logger(__name__)


async def relay_once() -> None:
    if not is_producer_available():

        return

    settings = get_settings()
