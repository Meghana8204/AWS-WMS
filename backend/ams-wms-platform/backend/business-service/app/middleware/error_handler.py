"""
Translates domain exceptions into HTTP responses - the FastAPI counterpart
of com.ams.common.web.GlobalExceptionHandler. Registered once on the app
in main.py; domain and application code never imports FastAPI/Starlette.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.common.domain.exceptions import DomainRuleViolationException, NotFoundException
from app.logging.logger import get_logger

logger = get_logger(__name__)


def _error_body(message: str) -> dict:
    return {"message": message, "timestamp": datetime.now(timezone.utc).isoformat()}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainRuleViolationException)
    async def handle_domain_rule_violation(request: Request, exc: DomainRuleViolationException):
        return JSONResponse(status_code=400, content=_error_body(str(exc)))

    @app.exception_handler(NotFoundException)
    async def handle_not_found(request: Request, exc: NotFoundException):
        return JSONResponse(status_code=404, content=_error_body(str(exc)))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("Unhandled exception", extra={"extra_fields": {"path": str(request.url)}})
        return JSONResponse(status_code=500, content=_error_body("Internal server error"))
