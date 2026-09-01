"""
FastAPI dependency-injection helpers for authentication and RBAC authorization.
Supports local dev mock user fallback when running in environment=local.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.settings import get_settings
from app.security.jwt import TokenValidationError, decode_and_validate

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    subject: str
    username: str
    roles: list[str]
    permissions: list[str]
    raw_claims: dict


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    settings = get_settings()

    if credentials is None:
        if settings.environment == "local":
            return CurrentUser(
                subject="local_security_officer",
                username="local_security_officer",
                roles=["ADMIN"],
                permissions=["gate:entry:create", "gate:entry:read", "gate:entry:verify"],
                raw_claims={},
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials
    if settings.environment == "local":
        if token.startswith("supplier-mock-token-"):
            token_payload = token.removeprefix("supplier-mock-token-")
            user_id = token_payload[:36]
            supplier_id = token_payload[37:] if len(token_payload) > 37 else None
            return CurrentUser(
                subject=user_id or "supplier",
                username="supplier",
                roles=["SUPPLIER"],
                permissions=[],
                raw_claims={"supplier_id": supplier_id} if supplier_id else {},
            )
        if token == "mock-jwt-admin-token" or token == "local_dev_mock_token":
            return CurrentUser(
                subject="admin",
                username="admin",
                roles=["ADMIN"],
                permissions=["gate:entry:create", "gate:entry:read", "gate:entry:verify", "gate:write", "warehouse:write"],
                raw_claims={},
            )
        elif token == "mock-jwt-warehouse-token":
            return CurrentUser(
                subject="warehouse_manager",
                username="warehouse_manager",
                roles=["WAREHOUSE", "ADMIN"],
                permissions=["gate:entry:create", "gate:entry:read", "gate:entry:verify", "gate:write", "warehouse:write"],
                raw_claims={},
            )
        elif token == "mock-jwt-gate-entry-token":
            return CurrentUser(
                subject="gate_security",
                username="gate_security",
                roles=["GATE_SECURITY"],
                permissions=["gate:entry:create", "gate:entry:read", "gate:entry:verify", "gate:write"],
                raw_claims={},
            )
        elif token == "mock-jwt-grn-token":
            return CurrentUser(
                subject="grn_officer",
                username="grn_officer",
                roles=["GRN", "WAREHOUSE"],
                permissions=["gate:entry:create", "gate:entry:read", "gate:entry:verify", "gate:write", "warehouse:write"],
                raw_claims={},
            )
        elif token == "mock-jwt-warehouse-token":
            return CurrentUser(
                subject="warehouse",
                username="warehouse",
                roles=["WAREHOUSE", "ADMIN"],
                permissions=["gate:write", "gate:entry:create", "gate:entry:read", "gate:entry:verify"],
                raw_claims={},
            )
        elif token == "mock-jwt-gate-entry-token" or token == "mock-jwt-grn-token":
            return CurrentUser(
                subject="gate_operator",
                username="gate_operator",
                roles=["GATE_OPERATOR", "ADMIN"],
                permissions=["gate:write", "gate:entry:create", "gate:entry:read", "gate:entry:verify"],
                raw_claims={},
            )
        elif token == "mock-jwt-procurement-token":
            return CurrentUser(
                subject="procurement",
                username="procurement",
                roles=["PROCUREMENT", "ADMIN"],
                permissions=["gate:write", "gate:entry:create", "gate:entry:read", "gate:entry:verify"],
                raw_claims={},
            )
        elif token == "mock-jwt-finance-token":
            return CurrentUser(
                subject="finance",
                username="finance",
                roles=["FINANCE", "ADMIN"],
                permissions=["gate:write", "gate:entry:create", "gate:entry:read", "gate:entry:verify"],
                raw_claims={},
            )

    try:
        claims = await decode_and_validate(token)
        return CurrentUser(
            subject=claims.get("sub", ""),
            username=claims.get("username", claims.get("sub", "")),
            roles=claims.get("roles", []),
            permissions=claims.get("permissions", []),
            raw_claims=claims,
        )
    except Exception as exc:
        if settings.environment == "local":
            return CurrentUser(
                subject="local_security_officer",
                username="local_security_officer",
                roles=["ADMIN"],
                permissions=["gate:entry:create", "gate:entry:read", "gate:entry:verify", "gate:write", "warehouse:write"],
                raw_claims={},
            )
        if isinstance(exc, TokenValidationError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
        raise



def require_permission(permission: str):
    async def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if permission not in user.permissions and "ADMIN" not in user.roles and "WAREHOUSE" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return user

    return _checker

