"""
FastAPI application entrypoint - business-service.
"""
from __future__ import annotations

import asyncio
# Force reload - updated 2026-08-14
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.kafka.producer import start_producer, stop_producer
from app.logging.logger import configure_logging, get_logger
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_context import RequestContextMiddleware
from app.modules.gate.infrastructure.api.router import (
    preview_router as gate_preview_router,
    router as gate_router,
)
from app.modules.gate.infrastructure.api.dashboard import router as dashboard_router
from app.modules.notification.infrastructure.api.router import router as notification_router
from app.modules.procurement.infrastructure.api.router import router as procurement_router
from app.modules.receiving.infrastructure.api.router import router as receiving_router
from app.modules.returns.infrastructure.api.router import router as returns_router
from app.modules.storage.infrastructure.api.router import router as storage_router
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

    # --- Development schema compatibility guard ---
    #
    # Older local databases can predate some of the fields now mapped by the
    # procurement ORM.  Use PostgreSQL's idempotent form rather than catching
    # duplicate-column errors: after a PostgreSQL statement fails, the whole
    # transaction is aborted and every later migration statement would fail.
    try:
        from sqlalchemy import text
        from app.database.session import session_scope

        # Helper to run DDL in its own transaction
        async def run_ddl(ddl_query: str):
            async with session_scope() as session:
                await session.execute(text(ddl_query))
                await session.commit()

        # Add columns to asn
        for col in [
            ("shipment_date", "DATE DEFAULT CURRENT_DATE"),
            ("driver_name", "VARCHAR(128)"),
            ("driver_contact", "VARCHAR(32)"),
            ("warehouse_id", "VARCHAR(64)"),
            ("transporter", "VARCHAR(128)"),
            ("number_of_packages", "INTEGER"),
            ("package_type", "VARCHAR(64)"),
            ("shipping_method", "VARCHAR(64)"),
            ("asn_number", "VARCHAR(64)"),
            ("supplier_id", "UUID"),
            ("po_id", "VARCHAR(64)"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE asn ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
                logger.debug(f"Ensured column {col[0]} exists on asn")
            except Exception: pass

        # Ensure supplier_contact has primary_email and secondary_email
        try:
            await run_ddl("ALTER TABLE supplier_contact RENAME COLUMN email TO primary_email")
            logger.debug("Renamed 'email' to 'primary_email' on supplier_contact")
        except Exception: pass

        try:
            await run_ddl("ALTER TABLE supplier_contact ADD COLUMN IF NOT EXISTS primary_email VARCHAR(128)")
        except Exception: pass

        try:
            await run_ddl("ALTER TABLE supplier_contact ADD COLUMN IF NOT EXISTS secondary_email VARCHAR(128)")
            logger.debug("Ensured primary/secondary email columns exist on supplier_contact")
        except Exception: pass

        # Ensure supplier has missing columns
        for col in [
            ("created_at", "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
            ("supplier_code", "VARCHAR(64)"),
            ("rating", "NUMERIC(3,2) DEFAULT 0"),
            ("performance_score", "NUMERIC(5,2) DEFAULT 0"),
            ("remarks", "VARCHAR(1000)"),
            ("status", "VARCHAR(32) DEFAULT 'Active'"),
            ("main_materials", "JSON"),
            ("industry", "VARCHAR(64)"),
            ("gstin", "VARCHAR(32)"),
            ("registered_company_name", "VARCHAR(256)"),
            ("vendor_type", "VARCHAR(64)"),
            ("category", "JSON"),
            ("created_by", "VARCHAR(64)"),
            ("updated_by", "VARCHAR(64)"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE supplier ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
            except Exception: pass

        # Ensure category is JSONB (it was incorrectly VARCHAR(64) in early versions)
        try:
            # More robust migration: handle existing VARCHAR data
            await run_ddl("""
                ALTER TABLE supplier
                ALTER COLUMN category TYPE JSONB
                USING (
                    CASE
                        WHEN category IS NULL THEN '[]'::JSONB
                        WHEN category = '' THEN '[]'::JSONB
                        WHEN category LIKE '[%' THEN category::JSONB
                        ELSE jsonb_build_array(category)
                    END
                )
            """)

            # Also ensure main_materials is JSONB
            await run_ddl("""
                ALTER TABLE supplier
                ALTER COLUMN main_materials TYPE JSONB
                USING (
                    CASE
                        WHEN main_materials IS NULL THEN '[]'::JSONB
                        WHEN main_materials = '' THEN '[]'::JSONB
                        WHEN main_materials LIKE '[%' THEN main_materials::JSONB
                        ELSE jsonb_build_array(main_materials)
                    END
                )
            """)
            logger.debug("Migrated 'category' and 'main_materials' to JSONB on supplier table")
        except Exception as e:
            logger.debug(f"JSONB migration skipped or already done: {e}")

        logger.debug("Ensured columns exist on supplier")

        # Ensure rfq has missing columns
        for col in [
            ("rfq_number", "VARCHAR(64)"),
            ("rfq_date", "DATE DEFAULT CURRENT_DATE"),
            ("material_request_number", "VARCHAR(64)"),
            ("required_delivery_date", "DATE"),
            ("warehouse", "VARCHAR(128)"),
            ("procurement_officer", "VARCHAR(128)"),
            ("remarks", "TEXT"),
            ("closing_date", "TIMESTAMP WITH TIME ZONE"),
            ("selected_supplier_id", "UUID"),
            ("selection_date", "DATE"),
            ("selected_by", "VARCHAR(128)"),
            ("selection_reason", "VARCHAR(500)"),
            ("selection_comments", "VARCHAR(500)"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE rfq ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
            except Exception: pass
        logger.debug("Ensured columns exist on rfq")

        # Ensure quotation has missing columns
        for col in [
            ("discount", "NUMERIC(18,4) DEFAULT 0"),
            ("tax", "NUMERIC(18,4) DEFAULT 0"),
            ("freight_charges", "NUMERIC(18,4) DEFAULT 0"),
            ("delivery_time", "VARCHAR(128)"),
            ("expected_delivery_date", "DATE"),
            ("payment_terms", "VARCHAR(128)"),
            ("quotation_validity", "DATE"),
            ("remarks", "VARCHAR(500)"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE quotation ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
            except Exception: pass
        logger.debug("Ensured columns exist on quotation")

        # Create purchase_order table if not exists
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS purchase_order (
                    id UUID PRIMARY KEY,
                    po_number VARCHAR(64) UNIQUE NOT NULL,
                    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    status VARCHAR(32) NOT NULL,
                    rfq_id UUID REFERENCES rfq(id),
                    supplier_id UUID REFERENCES supplier(id),
                    supplier_name VARCHAR(255),
                    warehouse_id VARCHAR(64),
                    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    expected_delivery_date DATE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Ensured purchase_order table exists")
        except Exception as e:
            logger.warning(f"Failed to create purchase_order table: {e}")

        # Create purchase_order_item table if not exists
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS purchase_order_item (
                    id UUID PRIMARY KEY,
                    purchase_order_id UUID REFERENCES purchase_order(id) ON DELETE CASCADE,
                    material_code VARCHAR(64) NOT NULL,
                    material_name VARCHAR(255),
                    quantity NUMERIC(18, 4) NOT NULL,
                    unit_price NUMERIC(18, 4) NOT NULL,
                    uom VARCHAR(32) NOT NULL DEFAULT 'PCS'
                )
            """)
            logger.debug("Ensured purchase_order_item table exists")
        except Exception as e:
            logger.warning(f"Failed to create purchase_order_item table: {e}")

        # Ensure purchase_order_item has missing columns
        for col in [
            ("category", "VARCHAR(128)"),
            ("discount", "NUMERIC(18, 4) DEFAULT 0"),
            ("tax", "NUMERIC(18, 4) DEFAULT 0"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE purchase_order_item ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
            except Exception: pass

        # Ensure purchase_order has missing columns
        for col in [
            ("subtotal", "NUMERIC(18, 4) DEFAULT 0"),
            ("discount_amount", "NUMERIC(18, 4) DEFAULT 0"),
            ("tax_amount", "NUMERIC(18, 4) DEFAULT 0"),
            ("freight_charges", "NUMERIC(18, 4) DEFAULT 0"),
            ("selection_reason", "VARCHAR(500)"),
            ("procurement_comments", "TEXT"),
            ("selection_date", "TIMESTAMP WITH TIME ZONE"),
            ("selected_by", "VARCHAR(128)"),
            ("procurement_officer", "VARCHAR(128)"),
            ("payment_terms", "VARCHAR(128)"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
            except Exception: pass

        # Additional PO Columns for full data snapshot
        for col in [
            ("department", "VARCHAR(128)"),
            ("supplier_code", "VARCHAR(64)"),
            ("supplier_contact_person", "VARCHAR(128)"),
            ("supplier_phone", "VARCHAR(32)"),
            ("supplier_email", "VARCHAR(128)"),
            ("supplier_gstin", "VARCHAR(32)"),
            ("supplier_address", "TEXT"),
            ("delivery_warehouse_name", "VARCHAR(128)"),
            ("delivery_address", "TEXT"),
            ("additional_charges", "NUMERIC(18, 4) DEFAULT 0"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS {col[0]} {col[1]}")
            except Exception: pass

        try:
            await run_ddl("ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS rejection_reason TEXT")
        except Exception: pass

        # Create po_approval_history table
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS po_approval_history (
                    id UUID PRIMARY KEY,
                    purchase_order_id UUID REFERENCES purchase_order(id) ON DELETE CASCADE,
                    status VARCHAR(32) NOT NULL,
                    actor_name VARCHAR(128) NOT NULL,
                    comments TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Ensured po_approval_history table exists")
        except Exception as e:
            logger.warning(f"Failed to create po_approval_history table: {e}")

        # Create notification table
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS notification (
                    id UUID PRIMARY KEY,
                    user_role VARCHAR(32) NOT NULL,
                    title VARCHAR(256) NOT NULL,
                    message TEXT NOT NULL,
                    link VARCHAR(512),
                    is_read BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Ensured notification table exists")
        except Exception as e:
            logger.warning(f"Failed to create notification table: {e}")

        # Create material_request table if not exists
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS material_request (
                    id UUID PRIMARY KEY,
                    request_number VARCHAR(64) UNIQUE NOT NULL,
                    warehouse_id VARCHAR(64) NOT NULL,
                    department VARCHAR(64) NOT NULL,
                    requested_by VARCHAR(128) NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                    required_date DATE NOT NULL,
                    remarks TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Ensured material_request table exists")
        except Exception as e:
            logger.warning(f"Failed to create material_request table: {e}")

        # Create material_request_item table if not exists
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS material_request_item (
                    id UUID PRIMARY KEY,
                    request_id UUID REFERENCES material_request(id) ON DELETE CASCADE,
                    material_code VARCHAR(64) NOT NULL,
                    material_name VARCHAR(255),
                    quantity NUMERIC(18, 4) NOT NULL,
                    uom VARCHAR(32) NOT NULL DEFAULT 'PCS'
                )
            """)
            logger.debug("Ensured material_request_item table exists")
        except Exception as e:
            logger.warning(f"Failed to create material_request_item table: {e}")

        # Create material_stock table
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS material_stock (
                    id UUID PRIMARY KEY,
                    material_code VARCHAR(64) UNIQUE NOT NULL,
                    material_name VARCHAR(255) NOT NULL,
                    category VARCHAR(128) NOT NULL,
                    on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    allocated NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    available NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    uom VARCHAR(32) NOT NULL DEFAULT 'PCS',
                    warehouse_id VARCHAR(64) NOT NULL,
                    reorder_point NUMERIC(18, 4) NOT NULL DEFAULT 10,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Ensured material_stock table exists")
        except Exception as e:
            logger.warning(f"Failed to create material_stock table: {e}")

        # Create arrival_notification table
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS arrival_notification (
                    id VARCHAR(128) PRIMARY KEY,
                    asn_id UUID NOT NULL REFERENCES asn(id) ON DELETE CASCADE,
                    asn_number VARCHAR(64) NOT NULL,
                    po_id VARCHAR(64),
                    po_number VARCHAR(64) NOT NULL,
                    warehouse_id VARCHAR(64) NOT NULL,
                    supplier_name VARCHAR(128) NOT NULL,
                    vehicle_number VARCHAR(64) NOT NULL,
                    expected_arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
                    driver_phone VARCHAR(32),
                    message TEXT,
                    recipients VARCHAR(256),
                    status VARCHAR(32) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Ensured arrival_notification table exists")
        except Exception as e:
            logger.warning(f"Failed to create arrival_notification table: {e}")

        # Ensure supplier_document has file_type, file_size and upload_id
        try:
            await run_ddl("ALTER TABLE supplier_document ADD COLUMN IF NOT EXISTS file_type VARCHAR(64)")
            await run_ddl("ALTER TABLE supplier_document ADD COLUMN IF NOT EXISTS file_size BIGINT")
            await run_ddl("ALTER TABLE supplier_document ADD COLUMN IF NOT EXISTS upload_id VARCHAR(128)")

            # Ensure they are nullable to prevent IntegrityErrors on incomplete data
            await run_ddl("ALTER TABLE supplier_document ALTER COLUMN file_type DROP NOT NULL")
            await run_ddl("ALTER TABLE supplier_document ALTER COLUMN file_size DROP NOT NULL")
            logger.debug("Ensured extended columns exist and are nullable on supplier_document")
        except Exception: pass

        # Create or ensure complete columns on gate_entry
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS gate_entry (
                    id UUID PRIMARY KEY,
                    gate_entry_number VARCHAR(64) UNIQUE,
                    po_id UUID,
                    asn_id UUID,
                    assigned_dock_id VARCHAR(32),
                    po_number VARCHAR(64) NOT NULL,
                    vehicle_number VARCHAR(32) NOT NULL,
                    driver_name VARCHAR(128) NOT NULL DEFAULT 'Driver',
                    driver_license_number VARCHAR(64),
                    driver_phone VARCHAR(32),
                    driver_photo_path VARCHAR(256),
                    po_document_path VARCHAR(256) NOT NULL DEFAULT '',
                    vehicle_photo_path VARCHAR(256),
                    po_document_data BYTEA,
                    vehicle_photo_data BYTEA,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_VERIFICATION',
                    verification_type VARCHAR(32),
                    mismatched_fields JSONB,
                    reasons JSONB,
                    anpr_detected_vehicle VARCHAR(32),
                    anpr_confidence NUMERIC(5, 4),
                    anpr_metadata JSONB,
                    ocr_po_number VARCHAR(64),
                    ocr_supplier_name VARCHAR(128),
                    ocr_product_material VARCHAR(128),
                    ocr_quantity NUMERIC(18, 4),
                    ocr_po_date VARCHAR(32),
                    ocr_expected_delivery_date VARCHAR(32),
                    ocr_confidence NUMERIC(5, 4),
                    ocr_raw_text TEXT,
                    ocr_line_items JSONB,
                    security_officer_id VARCHAR(64) NOT NULL DEFAULT 'SECURITY',
                    verified_by_user_id VARCHAR(64),
                    manual_verification_notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        except Exception: pass

        for col, col_type in [
            ("gate_entry_number", "VARCHAR(64)"),
            ("po_id", "UUID"),
            ("asn_id", "UUID"),
            ("assigned_dock_id", "VARCHAR(32)"),
            ("driver_license_number", "VARCHAR(64)"),
            ("driver_phone", "VARCHAR(32)"),
            ("driver_photo_path", "VARCHAR(256)"),
            ("po_document_path", "VARCHAR(256) DEFAULT ''"),
            ("vehicle_photo_path", "VARCHAR(256)"),
            ("po_document_data", "BYTEA"),
            ("vehicle_photo_data", "BYTEA"),
            ("verification_type", "VARCHAR(32)"),
            ("mismatched_fields", "JSONB"),
            ("reasons", "JSONB"),
            ("anpr_detected_vehicle", "VARCHAR(32)"),
            ("anpr_confidence", "NUMERIC(5, 4)"),
            ("anpr_metadata", "JSONB"),
            ("ocr_po_number", "VARCHAR(64)"),
            ("ocr_supplier_name", "VARCHAR(128)"),
            ("ocr_product_material", "VARCHAR(128)"),
            ("ocr_quantity", "NUMERIC(18, 4)"),
            ("ocr_po_date", "VARCHAR(32)"),
            ("ocr_expected_delivery_date", "VARCHAR(32)"),
            ("ocr_confidence", "NUMERIC(5, 4)"),
            ("ocr_raw_text", "TEXT"),
            ("ocr_line_items", "JSONB"),
            ("security_officer_id", "VARCHAR(64) DEFAULT 'SECURITY'"),
            ("verified_by_user_id", "VARCHAR(64)"),
            ("manual_verification_notes", "TEXT"),
            ("created_at", "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
            ("updated_at", "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        ]:
            try:
                await run_ddl(f"ALTER TABLE gate_entry ADD COLUMN IF NOT EXISTS {col} {col_type}")
            except Exception: pass

        # Create warehouse workflow tables if not exist
        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS warehouse_dock (
                    id UUID PRIMARY KEY,
                    dock_number VARCHAR(32) UNIQUE NOT NULL,
                    warehouse_id VARCHAR(64) NOT NULL,
                    dock_type VARCHAR(64) NOT NULL,
                    capacity INTEGER NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        except Exception: pass

        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS inventory_receipt_posting (
                    id UUID PRIMARY KEY,
                    grn_id UUID NOT NULL,
                    grn_number VARCHAR(64),
                    po_id UUID,
                    po_number VARCHAR(64),
                    asn_id UUID,
                    asn_number VARCHAR(64),
                    supplier_name VARCHAR(256),
                    item_code VARCHAR(64) NOT NULL,
                    material_name VARCHAR(256),
                    uom VARCHAR(32),
                    warehouse_id VARCHAR(64),
                    posted_quantity NUMERIC(18, 4) NOT NULL,
                    on_hand_before NUMERIC(18, 4) NOT NULL,
                    on_hand_after NUMERIC(18, 4) NOT NULL,
                    posted_by VARCHAR(128) NOT NULL,
                    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        except Exception: pass

        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS storage_location (
                    id UUID PRIMARY KEY,
                    warehouse_id VARCHAR(64) NOT NULL,
                    zone VARCHAR(32) NOT NULL,
                    rack VARCHAR(32) NOT NULL,
                    bin VARCHAR(32) NOT NULL,
                    capacity NUMERIC(18, 4) NOT NULL DEFAULT 1000,
                    occupied_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        except Exception: pass

        try:
            await run_ddl("""
                CREATE TABLE IF NOT EXISTS putaway_task (
                    id UUID PRIMARY KEY,
                    task_number VARCHAR(64) UNIQUE NOT NULL,
                    grn_id UUID,
                    grn_number VARCHAR(64),
                    item_code VARCHAR(64) NOT NULL,
                    material_name VARCHAR(256),
                    quantity NUMERIC(18, 4) NOT NULL,
                    uom VARCHAR(32),
                    warehouse_id VARCHAR(64),
                    source_location VARCHAR(64),
                    destination_location_id UUID,
                    destination_zone VARCHAR(32),
                    destination_rack VARCHAR(32),
                    destination_bin VARCHAR(32),
                    location_assigned_by VARCHAR(128),
                    location_assigned_at TIMESTAMP WITH TIME ZONE,
                    status VARCHAR(32) NOT NULL DEFAULT 'PUTAWAY_PENDING',
                    created_by VARCHAR(128) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
        except Exception: pass
    except Exception as e:
        logger.warning(f"Auto-migration failed: {e}", exc_info=True)

    try:
        await start_producer()
    except Exception as exc:
        logger.debug(f"Kafka producer start skipped (Kafka offline or unavailable): {exc}")

    scheduler.add_job(
        relay_once,
        "interval",
        seconds=settings.outbox_poll_interval_seconds,
        id="outbox-relay",
        max_instances=1,
        coalesce=True,
    )

    # Add arrival notification check (every hour in prod, more frequent for dev demo)
    from app.modules.procurement.infrastructure.api.router import check_upcoming_arrivals
    scheduler.add_job(
        check_upcoming_arrivals,
        "interval",
        minutes=1, # Check every minute for real-time demo feel
        id="arrival-notification-check",
        max_instances=1,
        coalesce=True
    )

    scheduler.start()

    try:
        _consumer_task = asyncio.create_task(start_notification_consumer())
    except Exception as exc:
        logger.debug(f"Notification consumer task failed to start: {exc}")

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
    for o in ["http://localhost:8080", "http://127.0.0.1:8080"]:
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
    app.include_router(storage_router)
    app.include_router(notification_router)
    app.include_router(gate_router)
    app.include_router(gate_preview_router)
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
