"""FastAPI dependency injection - DI seam for test overrides."""

from __future__ import annotations

from collections.abc import Generator
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, status

from api.config import Settings, get_settings


def get_supabase_client(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[Any, None, None]:
    """Yield Supabase client. Override in tests for mocking."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        yield None
        return

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    yield client


def _bearer_access_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return token or None


def get_bearer_raw_token(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Return the raw JWT from Authorization: Bearer (for logout / sign-out)."""
    token = _bearer_access_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return token


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    client: Any = Depends(get_supabase_client),
) -> dict:
    """Validate access token from Authorization: Bearer and return current user.
    Use as a dependency on protected routes.
    Raises 401 if token is missing/invalid.
    """
    access_token = _bearer_access_token(authorization)
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    from database.auth import get_current_user as verify_token
    from database.exceptions import AuthenticationError

    try:
        user = verify_token(client, access_token)
        return user
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
