"""Authentication endpoints."""

from enum import Enum
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from api.dependencies import get_bearer_raw_token, get_current_user, get_supabase_client
from database.constants import Tables
from database.exceptions import AuthenticationError, DatabaseError
from database.teams import create_team
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


class LoginResponse(BaseModel):
    """Sign-in payload: user profile plus tokens for Authorization header flow."""

    user: UserResponse
    access_token: str
    refresh_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str


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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> UserResponse:
    """Register a new user with agent or supervisor role.

    For supervisors, automatically creates a team and assigns them to it.
    """
    auth_client = _require_client(client)

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

        # If supervisor, auto-create a team and assign them to it
        if request.role == UserRole.supervisor:
            team_name = f"{request.first_name}'s Team"
            team = create_team(auth_client, name=team_name, supervisor_id=user.id)

            # Update the user's team_id
            auth_client.table(Tables.USERS).update({"team_id": team["id"]}).eq(
                "id", user.id
            ).execute()

            # Update the returned user object with the team_id
            user = get_current_user_profile(auth_client, user_id=user.id, email=user.email)

    except DatabaseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _to_user_response(user)


@router.post("/login", response_model=LoginResponse)
def login(
    request: LoginRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> LoginResponse:
    """Sign in and return tokens plus user profile (Bearer auth; no cookies)."""
    auth_client = _require_client(client)

    try:
        result = login_user(auth_client, request.email, request.password)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    return LoginResponse(
        user=_to_user_response(result.user),
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _: Annotated[dict, Depends(get_current_user)],
    access_token: Annotated[str, Depends(get_bearer_raw_token)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> None:
    """Sign out using Bearer access token; invalidate server-side session."""
    auth_client = _require_client(client)
    logout_user(auth_client, access_token)


@router.get("/me", response_model=UserResponse)
def me(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> UserResponse:
    """Get current authenticated user."""
    auth_client = _require_client(client)
    user = get_current_user_profile(
        auth_client,
        user_id=current_user["id"],
        email=current_user["email"],
    )
    return _to_user_response(user)


@router.post("/refresh", response_model=RefreshTokenResponse)
def refresh(
    request: RefreshRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> RefreshTokenResponse:
    """Rotate access and refresh tokens using refresh_token in the body."""
    auth_client = _require_client(client)

    if not request.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    try:
        tokens = refresh_user_tokens(auth_client, request.refresh_token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    return RefreshTokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
    )


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    client: Annotated[Any, Depends(get_supabase_client)],
) -> MessageResponse:
    """Request a password reset email."""
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
