"""
FastAPI application entrypoint - business-service.
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
from app.modules.gate.infrastructure.api.dashboard import router as dashboard_router
from app.modules.notification.infrastructure.api.router import router as notification_router
from app.modules.procurement.infrastructure.api.router import router as procurement_router
from app.modules.receiving.infrastructure.api.router import router as receiving_router
from app.modules.returns.infrastructure.api.router import router as returns_router
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

    # --- Auto-Migration for missing Purchase Order columns ---
    try:
        from sqlalchemy import text
        from app.database.session import get_uow
        async with get_uow() as uow:
            # Add columns to purchase_order
            for col in [
                ("department", "VARCHAR(128)"),
                ("procurement_officer", "VARCHAR(128)"),
                ("delivery_warehouse", "VARCHAR(128)"),
                ("delivery_address", "TEXT"),
                ("additional_charges", "NUMERIC(18, 2) DEFAULT 0.0"),
            ]:
                try:
                    await uow.session.execute(text(f"ALTER TABLE purchase_order ADD COLUMN {col[0]} {col[1]}"))
                    logger.info(f"Added column {col[0]} to purchase_order")
                except Exception:
                    pass # Column likely already exists

            # Add columns to purchase_order_line
            for col in [
                ("material_name", "VARCHAR(256)"),
                ("category", "VARCHAR(128)"),
                ("uom", "VARCHAR(64)"),
                ("discount", "NUMERIC(18, 4) DEFAULT 0.0"),
                ("tax", "NUMERIC(18, 4) DEFAULT 0.0"),
            ]:
                try:
                    await uow.session.execute(text(f"ALTER TABLE purchase_order_line ADD COLUMN {col[0]} {col[1]}"))
                    logger.info(f"Added column {col[0]} to purchase_order_line")
                except Exception:
                    pass # Column likely already exists

            # Add columns to asn
            for col in [
                ("shipment_date", "DATE DEFAULT CURRENT_DATE"),
                ("driver_name", "VARCHAR(128)"),
                ("driver_contact", "VARCHAR(32)"),
            ]:
                try:
                    await uow.session.execute(text(f"ALTER TABLE asn ADD COLUMN {col[0]} {col[1]}"))
                    logger.info(f"Added column {col[0]} to asn")
                except Exception:
                    pass
            await uow.commit()
    except Exception as e:
        logger.warning(f"Auto-migration failed: {e}")

    try:
        await start_producer()
    except Exception as exc:
        logger.warning(f"Kafka producer start skipped (Kafka offline or unavailable): {exc}")

    scheduler.add_job(
        relay_once,
        "interval",
        seconds=settings.outbox_poll_interval_seconds,
        id="outbox-relay",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()

    try:
        _consumer_task = asyncio.create_task(start_notification_consumer())
    except Exception as exc:
        logger.warning(f"Notification consumer task failed to start: {exc}")

    logger.info("business-service started", extra={"extra_fields": {"environment": settings.environment}})

    yield

    scheduler.shutdown(wait=False)
    if _consumer_task is not None:
        _consumer_task.cancel()
    try:
        await stop_producer()
    except Exception:
        pass
    logger.info("business-service stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AMS/WMS Business Service",
        description="Python business backend: inventory, warehouse, receiving, returns, gate entry, and related domains.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # --- CORS Configuration -----------------------------------------------
    # Robustly handle origins from settings (could be List[str] or comma-separated string)
    raw_origins = settings.cors_allow_origins
    if isinstance(raw_origins, str):
        try:
            import json
            origins = json.loads(raw_origins)
        except:
            origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    else:
        origins = list(raw_origins)

    # Always ensure common local dev origins are present for ease of use
    for o in ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"]:
        if o not in origins:
            origins.append(o)

    # Register request context first so CORS wraps normal application responses.
    # Top-level exception responses are covered in the centralized error handler.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    register_exception_handlers(app)

    # Local development authentication override (for standalone testing without auth-service)
    if settings.environment.lower() in ("local", "test", "development"):
        from app.security.dependencies import CurrentUser, get_current_user

        def get_local_dev_user() -> CurrentUser:
            return CurrentUser(
                subject="local-dev-user-123",
                username="localdev",
                roles=["ADMIN", "PROCUREMENT"],
                permissions=["procurement:create", "procurement:read", "gate:entry:read", "gate:entry:create"],
                raw_claims={"sub": "local-dev-user-123", "username": "localdev"},
            )

        app.dependency_overrides[get_current_user] = get_local_dev_user

    app.include_router(receiving_router)
    app.include_router(returns_router)
    app.include_router(notification_router)
    app.include_router(gate_router)
    app.include_router(dashboard_router)
    app.include_router(procurement_router)

    from fastapi.staticfiles import StaticFiles
    import os
    os.makedirs("media_uploads", exist_ok=True)
    app.mount("/media", StaticFiles(directory="media_uploads"), name="media")

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