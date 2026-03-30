"""Authentication endpoints."""

import base64
import json
from enum import Enum
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr

from api.config import Settings, get_settings
from api.dependencies import get_current_user, get_supabase_client
from database.auth import authenticate_user, create_auth_user, sign_out
from database.exceptions import AuthenticationError, DatabaseError
from database.exceptions import AuthenticationError, DatabaseError
from services.auth import (
    AuthUser,
    change_user_password,
    get_current_user_profile,
    login_user,
    logout_user,
    refresh_user_tokens,
    register_user,
    request_password_reset,
    reset_user_password,
)

router = APIRouter()


class UserRole(str, Enum):
    supervisor = "supervisor"
    agent = "agent"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: UserRole
    team_id: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: UserRole | None = None
    team_id: str | None = None


def _get_user_profile(client: Any, user_id: str) -> dict | None:
    """Fetch user profile from users table."""
    try:
        result = client.table("users").select("*").eq("id", user_id).single().execute()
        return result.data
    except Exception:
        return None
class RefreshResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def _require_client(client: Any) -> Any:
    """Ensure the auth client is available before handling the request."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )
    return client


def _to_user_response(user: AuthUser) -> UserResponse:
    """Convert a service-layer user into an API response model."""
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        team_id=user.team_id,
    )


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    settings: Settings,
) -> None:
    """Set httpOnly auth cookies on response."""
    """Set HTTP-only auth cookies on the response."""
    cookie_settings = {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
        "path": "/",
    }
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=3600,  # 1 hour
        **cookie_settings,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=604800,  # 7 days
    response.set_cookie(key="access_token", value=access_token, max_age=3600, **cookie_settings)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=604800,
        **cookie_settings,
    )


def _clear_auth_cookies(response: Response, settings: Settings) -> None:
    """Clear auth cookies from response."""
    """Clear auth cookies from the response."""
    cookie_settings = {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
        "path": "/",
    }
    response.delete_cookie(key="access_token", **cookie_settings)
    response.delete_cookie(key="refresh_token", **cookie_settings)


def _is_recovery_or_otp_token(token: str) -> bool:
    """Check if a JWT is a recovery or OTP token by inspecting its 'amr' claim."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        payload_b64 = parts[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        amr = payload.get("amr", [])
        return any(x.get("method") in ("recovery", "otp") for x in amr)
    except Exception:
        return False


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> UserResponse:
    """Register a new user."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    try:
        # Create Supabase Auth user
        auth_user = create_auth_user(client, request.email, request.password)
        user_id = auth_user["id"]

        # Insert into users table
        user_data = {
            "id": user_id,
            "email": request.email,
            "first_name": request.first_name,
            "last_name": request.last_name,
            "role": request.role.value,
        }
        if request.team_id:
            user_data["team_id"] = request.team_id

        try:
            client.table("users").insert(user_data).execute()
        except Exception as e:
            # Rollback: delete the created auth user
            client.auth.admin.delete_user(user_id)
            raise DatabaseError("Failed to create user profile") from e

        return UserResponse(
            id=user_id,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name,
            role=request.role,
            team_id=request.team_id,
        )
    except DatabaseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    auth_client = _require_client(client)

    if request.role is not UserRole.agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor accounts must be created by an administrator",
        )

    try:
        user = register_user(
            auth_client,
            email=request.email,
            password=request.password,
            first_name=request.first_name,
            last_name=request.last_name,
            role=request.role.value,
            team_id=request.team_id,
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _to_user_response(user)


@router.post("/login", response_model=UserResponse)
def login(
    request: LoginRequest,
    response: Response,
    client: Annotated[Any, Depends(get_supabase_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UserResponse:
    """Sign in and set auth cookies."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    try:
        result = authenticate_user(client, request.email, request.password)
        user = result["user"]
        session = result["session"]

        _set_auth_cookies(
            response,
            session.access_token,
            session.refresh_token,
            settings,
        )

        # Fetch user profile from users table
        profile = _get_user_profile(client, user.id)
        if profile:
            return UserResponse(
                id=user.id,
                email=user.email,
                first_name=profile.get("first_name"),
                last_name=profile.get("last_name"),
                role=profile.get("role"),
                team_id=profile.get("team_id"),
            )

        return UserResponse(id=user.id, email=user.email)
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    auth_client = _require_client(client)

    try:
        result = login_user(auth_client, request.email, request.password)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    _set_auth_cookies(
        response,
        result.tokens.access_token,
        result.tokens.refresh_token,
        settings,
    )
    return _to_user_response(result.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    client: Annotated[Any, Depends(get_supabase_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    access_token: Annotated[str | None, Cookie()] = None,
) -> None:
    """Sign out and clear auth cookies."""
    _clear_auth_cookies(response, settings)

    if client is not None and access_token:
        try:
            sign_out(client, access_token)
        except DatabaseError:
            pass  # Cookie cleared anyway
    if client is not None:
        logout_user(client, access_token)


@router.get("/me", response_model=UserResponse)
def me(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> UserResponse:
    """Get current authenticated user."""
    # Fetch full profile from users table
    profile = _get_user_profile(client, current_user["id"]) if client else None
    if profile:
        return UserResponse(
            id=current_user["id"],
            email=current_user["email"],
            first_name=profile.get("first_name"),
            last_name=profile.get("last_name"),
            role=profile.get("role"),
            team_id=profile.get("team_id"),
        )

    return UserResponse(id=current_user["id"], email=current_user["email"])


class RefreshResponse(BaseModel):
    message: str
    auth_client = _require_client(client)
    user = get_current_user_profile(
        auth_client,
        user_id=current_user["id"],
        email=current_user["email"],
    )
    return _to_user_response(user)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    response: Response,
    client: Annotated[Any, Depends(get_supabase_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> RefreshResponse:
    """Refresh access token using refresh token cookie."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )
    """Refresh access token using the refresh token cookie."""
    auth_client = _require_client(client)

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    try:
        result = client.auth.refresh_session(refresh_token)
        if not result.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        _set_auth_cookies(
            response,
            result.session.access_token,
            result.session.refresh_token,
            settings,
        )
        return RefreshResponse(message="Token refreshed successfully")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str
        tokens = refresh_user_tokens(auth_client, refresh_token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token, settings)
    return RefreshResponse(message="Token refreshed successfully")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> MessageResponse:
    """Request a password reset email."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    try:
        client.auth.reset_password_email(request.email)
        # Always return success to prevent email enumeration
        return MessageResponse(message="If the email exists, a reset link has been sent")
    except Exception:
        # Still return success to prevent email enumeration
        return MessageResponse(message="If the email exists, a reset link has been sent")


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    auth_client = _require_client(client)

    try:
        request_password_reset(auth_client, request.email)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset is temporarily unavailable",
        ) from exc

    return MessageResponse(message="If the email exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: ResetPasswordRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> MessageResponse:
    """Set a new password using an access token from recovery email."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    try:
        if not _is_recovery_or_otp_token(request.token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Only recovery tokens are allowed.",
            )

        # Use the access_token from recovery email to get user and update password
        user_response = client.auth.get_user(request.token)
        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired reset token",
            )

        # Update password using admin API
        client.auth.admin.update_user_by_id(
            user_response.user.id, {"password": request.new_password}
        )
        return MessageResponse(message="Password reset successfully")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset token",
        )


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    """Set a new password using an access token from a recovery email."""
    auth_client = _require_client(client)

    try:
        reset_user_password(auth_client, request.token, request.new_password)
    except AuthenticationError as exc:
        detail = str(exc)
        if detail != "Invalid token type. Only recovery tokens are allowed.":
            detail = "Invalid or expired reset token"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail) from exc

    return MessageResponse(message="Password reset successfully")


@router.patch("/change-password", response_model=MessageResponse)
def change_password(
    request: ChangePasswordRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
    access_token: Annotated[str | None, Cookie()] = None,
) -> MessageResponse:
    """Change password for authenticated user."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )

    try:
        # Verify current password by attempting sign in
        client.auth.sign_in_with_password(
            {
                "email": current_user["email"],
                "password": request.current_password,
            }
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    try:
        # Update to new password
        client.auth.admin.update_user_by_id(current_user["id"], {"password": request.new_password})
        return MessageResponse(message="Password changed successfully")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to update password",
        )
) -> MessageResponse:
    """Change password for the current authenticated user."""
    auth_client = _require_client(client)

    try:
        change_user_password(
            auth_client,
            user_id=current_user["id"],
            email=current_user["email"],
            current_password=request.current_password,
            new_password=request.new_password,
        )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return MessageResponse(message="Password changed successfully")
