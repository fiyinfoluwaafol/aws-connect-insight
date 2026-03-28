"""Authentication service layer."""

import base64
import json
from dataclasses import dataclass

from supabase import Client

from database.auth import (
    authenticate_user,
    create_auth_user,
    delete_auth_user,
    get_auth_user_for_token,
    refresh_auth_session,
    send_password_reset_email,
    sign_out,
    update_auth_user_password,
    verify_user_password,
)
from database.constants import Role
from database.exceptions import AuthenticationError, DatabaseError, NotFoundError
from database.users import create_user, get_user_by_id


@dataclass(frozen=True)
class AuthTokens:
    """Authentication tokens returned by Supabase."""

    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class AuthUser:
    """User data returned to the API layer."""

    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None
    team_id: str | None = None


@dataclass(frozen=True)
class LoginResult:
    """Combined login result for the API layer."""

    user: AuthUser
    tokens: AuthTokens


def _clean_error_message(error: Exception, default_message: str) -> str:
    """Strip internal helper names from decorator-raised error messages."""
    message = str(error).strip()
    if not message:
        return default_message
    if " failed: " in message:
        message = message.split(" failed: ", 1)[1].strip()
    return message or default_message


def _is_recovery_or_otp_token(token: str) -> bool:
    """Check whether the token was issued for password recovery."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        payload_b64 = parts[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        amr = payload.get("amr", [])
        return any(item.get("method") in {"recovery", "otp"} for item in amr)
    except Exception:
        return False


def _get_user_profile(client: Client, user_id: str) -> dict | None:
    """Fetch a user profile when present."""
    try:
        return get_user_by_id(client, user_id)
    except NotFoundError:
        return None


def _build_auth_user(profile: dict | None, *, user_id: str, email: str) -> AuthUser:
    """Normalize profile data into the API-facing user shape."""
    if profile is None:
        return AuthUser(id=user_id, email=email)

    return AuthUser(
        id=user_id,
        email=email,
        first_name=profile.get("first_name"),
        last_name=profile.get("last_name"),
        role=profile.get("role"),
        team_id=profile.get("team_id"),
    )


def register_user(
    client: Client,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role: str,
    team_id: str | None = None,
) -> AuthUser:
    """Register a Supabase auth user and matching profile record."""
    try:
        auth_user = create_auth_user(client, email, password)
    except AuthenticationError as exc:
        raise DatabaseError(_clean_error_message(exc, "Failed to create user account")) from exc

    try:
        profile = create_user(
            client,
            user_id=auth_user["id"],
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=Role(role),
            team_id=team_id,
        )
    except DatabaseError as exc:
        try:
            delete_auth_user(client, auth_user["id"])
        except AuthenticationError:
            pass
        raise DatabaseError(_clean_error_message(exc, "Failed to create user profile")) from exc

    return _build_auth_user(profile, user_id=auth_user["id"], email=auth_user["email"])


def login_user(client: Client, email: str, password: str) -> LoginResult:
    """Authenticate a user and return profile data with session tokens."""
    try:
        auth_result = authenticate_user(client, email, password)
    except AuthenticationError as exc:
        raise AuthenticationError("Invalid email or password") from exc

    profile = _get_user_profile(client, auth_result["user_id"])
    user = _build_auth_user(profile, user_id=auth_result["user_id"], email=auth_result["email"])
    tokens = AuthTokens(
        access_token=auth_result["access_token"],
        refresh_token=auth_result["refresh_token"],
    )
    return LoginResult(user=user, tokens=tokens)


def logout_user(client: Client, access_token: str | None) -> None:
    """Attempt to close the current session without failing logout UX."""
    if not access_token:
        return

    try:
        sign_out(client, access_token)
    except AuthenticationError:
        pass


def get_current_user_profile(client: Client, user_id: str, email: str) -> AuthUser:
    """Return the enriched current user profile when available."""
    profile = _get_user_profile(client, user_id)
    return _build_auth_user(profile, user_id=user_id, email=email)


def refresh_user_tokens(client: Client, refresh_token: str) -> AuthTokens:
    """Refresh the access and refresh tokens."""
    try:
        token_data = refresh_auth_session(client, refresh_token)
    except AuthenticationError as exc:
        raise AuthenticationError("Invalid or expired refresh token") from exc

    return AuthTokens(
        access_token=token_data["access_token"],
        refresh_token=token_data["refresh_token"],
    )


def request_password_reset(client: Client, email: str) -> None:
    """Request a password reset email."""
    send_password_reset_email(client, email)


def reset_user_password(client: Client, token: str, new_password: str) -> None:
    """Set a new password using a recovery token."""
    if not _is_recovery_or_otp_token(token):
        raise AuthenticationError("Invalid token type. Only recovery tokens are allowed.")

    try:
        auth_user = get_auth_user_for_token(client, token)
        update_auth_user_password(client, auth_user["id"], new_password)
    except AuthenticationError as exc:
        raise AuthenticationError("Invalid or expired reset token") from exc


def change_user_password(
    client: Client,
    user_id: str,
    email: str,
    current_password: str,
    new_password: str,
) -> None:
    """Change the password for an authenticated user."""
    try:
        verify_user_password(client, email, current_password)
    except AuthenticationError as exc:
        raise AuthenticationError("Current password is incorrect") from exc

    try:
        update_auth_user_password(client, user_id, new_password)
    except AuthenticationError as exc:
        raise DatabaseError("Failed to update password") from exc
