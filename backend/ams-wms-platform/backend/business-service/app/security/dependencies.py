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
    from app.config.settings import get_settings

    settings = get_settings()

    if credentials is None or credentials.credentials in ("dev-token", "dev"):
        if settings.environment == "local":
            return CurrentUser(
                subject="dev-user-001",
                username="dev_admin",
                roles=["ADMIN"],
                permissions=[
                    "procurement:read",
                    "procurement:write",
                    "receiving:read",
                    "receiving:write",
                    "returns:read",
                    "returns:write",
                    "notification:read",
                    "notification:write",
                ],
                raw_claims={"env": "local"},
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        claims = await decode_and_validate(credentials.credentials)
    except TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

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
