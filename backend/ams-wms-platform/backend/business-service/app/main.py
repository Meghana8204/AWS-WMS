"""
FastAPI application entrypoint - business-service.

Wires together: routers for every implemented module, the JWT/RBAC
security layer (validated locally against the Java auth-service's JWKS),
exception handling, Kafka producer lifecycle, and the outbox relay /
notification consumer background jobs, via a lifespan context manager.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.kafka.producer import start_producer, stop_producer
from app.logging.logger import configure_logging, get_logger
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_context import RequestContextMiddleware
from app.modules.gate.infrastructure.api.router import router as gate_router
from app.modules.masterdata.infrastructure.api.router import router as supplier_router
from app.modules.notification.infrastructure.api.router import router as notification_router
from app.modules.procurement.infrastructure.api.router import router as procurement_router
from app.modules.receiving.infrastructure.api.router import router as receiving_router
from app.modules.returns.infrastructure.api.router import router as returns_router
from app.workers.arrival_tracker import check_arrival_notifications_once
from app.workers.notification_consumer import start_notification_consumer
from app.workers.outbox_relay import relay_once

configure_logging()
logger = get_logger(__name__)

scheduler = AsyncIOScheduler()
_consumer_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    global _consumer_task

    await start_producer()

    if not scheduler.running:
        scheduler.add_job(
            relay_once,
            "interval",
            seconds=settings.outbox_poll_interval_seconds,
            id="outbox-relay",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        scheduler.add_job(
            check_arrival_notifications_once,
            "interval",
            hours=6,
            id="arrival-tracker",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
        scheduler.start()

    _consumer_task = asyncio.create_task(start_notification_consumer())

    logger.info("business-service started", extra={"extra_fields": {"environment": settings.environment}})
    yield

    if scheduler.running:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass
    if _consumer_task is not None:
        _consumer_task.cancel()
    await stop_producer()
    logger.info("business-service stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AMS/WMS Business Service",
        description="Python business backend: procurement, purchase orders, supplier management, gate entry, receiving, returns, and related domains.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    app.include_router(receiving_router)
    app.include_router(returns_router)
    app.include_router(notification_router)
    app.include_router(procurement_router)
    app.include_router(supplier_router)
    app.include_router(gate_router)

    @app.get("/health", tags=["ops"])
    async def health() -> dict:
        return {"status": "UP", "service": settings.service_name}

    @app.get("/health/ready", tags=["ops"])
    async def readiness() -> dict:
        return {"status": "READY"}

    if settings.prometheus_enabled:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    return app


app = create_app()
