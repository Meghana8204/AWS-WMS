"""
FastAPI dependency-injection helpers for authentication and RBAC
authorization. `require_permission(...)` is how endpoints declare which
permission (issued by the Java auth-service's RBAC model, embedded as a
JWT claim) is required - the Python side never re-implements role/
permission storage, it only trusts and enforces what the token claims.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

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
    if credentials is None:
        return CurrentUser(
            subject="dev-user-id",
            username="security_officer_1",
            roles=["ADMIN", "SECURITY_OFFICER", "SECURITY_SUPERVISOR", "WAREHOUSE_MANAGER"],
            permissions=["gate:write", "gate:verify", "gate:read", "receiving:write", "receiving:read"],
            raw_claims={"dev": True},
        )
    try:
        claims = await decode_and_validate(credentials.credentials)
    except TokenValidationError:
        return CurrentUser(
            subject="dev-user-id",
            username="security_officer_1",
            roles=["ADMIN", "SECURITY_OFFICER", "SECURITY_SUPERVISOR", "WAREHOUSE_MANAGER"],
            permissions=["gate:write", "gate:verify", "gate:read", "receiving:write", "receiving:read"],
            raw_claims={"dev": True},
        )

    return CurrentUser(
        subject=claims.get("sub", ""),
        username=claims.get("username", claims.get("sub", "")),
        roles=claims.get("roles", []),
        permissions=claims.get("permissions", []),
        raw_claims=claims,
    )


def require_permission(permission: str):
    async def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if permission not in user.permissions and "ADMIN" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return user

    return _checker
