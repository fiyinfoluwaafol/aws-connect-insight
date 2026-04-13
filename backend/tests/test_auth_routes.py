"""API tests for authentication routes."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api import dependencies
from api.routers import auth as auth_router
from database.exceptions import AuthenticationError
from services.auth import AuthTokens, AuthUser, LoginResult


@pytest.fixture
def current_user_override(app):
    """Override the current-user dependency for authenticated route tests."""

    def _set(user: dict) -> None:
        app.dependency_overrides[dependencies.get_current_user] = lambda: user

    yield _set
    app.dependency_overrides.pop(dependencies.get_current_user, None)


def test_register_returns_created_user(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/register returns the created user."""
    register_mock = MagicMock(
        return_value=AuthUser(
            id="user-1",
            email="test@example.com",
            first_name="Test",
            last_name="User",
            role="agent",
        )
    )
    monkeypatch.setattr(auth_router, "register_user", register_mock)

    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "User",
            "role": "agent",
        },
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": "user-1",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "role": "agent",
        "team_id": None,
    }
    register_mock.assert_called_once_with(
        mock_supabase,
        email="test@example.com",
        password="password123",
        first_name="Test",
        last_name="User",
        role="agent",
        team_id=None,
    )


def test_register_rejects_public_supervisor_signup(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/register allows supervisor signup and creates a team."""
    register_mock = MagicMock(
        return_value=AuthUser(
            id="user-1",
            email="supervisor@example.com",
            first_name="Test",
            last_name="Supervisor",
            role="supervisor",
            team_id=None,
        )
    )
    monkeypatch.setattr(auth_router, "register_user", register_mock)

    # Mock create_team
    create_team_mock = MagicMock(return_value={"id": "team-1", "name": "Test's Team"})
    monkeypatch.setattr(auth_router, "create_team", create_team_mock)

    # Mock get_current_user_profile
    profile_mock = MagicMock(
        return_value=AuthUser(
            id="user-1",
            email="supervisor@example.com",
            first_name="Test",
            last_name="Supervisor",
            role="supervisor",
            team_id="team-1",
        )
    )
    monkeypatch.setattr(auth_router, "get_current_user_profile", profile_mock)

    response = client.post(
        "/api/auth/register",
        json={
            "email": "supervisor@example.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "Supervisor",
            "role": "supervisor",
        },
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": "user-1",
        "email": "supervisor@example.com",
        "first_name": "Test",
        "last_name": "Supervisor",
        "role": "supervisor",
        "team_id": "team-1",
    }
    register_mock.assert_called_once()
    create_team_mock.assert_called_once_with(
        mock_supabase, name="Test's Team", supervisor_id="user-1"
    )
    profile_mock.assert_called_once()


def test_login_returns_user_and_tokens_in_body(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/login returns user plus access and refresh tokens (Bearer flow)."""
    login_mock = MagicMock(
        return_value=LoginResult(
            user=AuthUser(
                id="user-1",
                email="test@example.com",
                first_name="Test",
                last_name="User",
                role="supervisor",
                team_id="team-1",
            ),
            tokens=AuthTokens(
                access_token="access-token",
                refresh_token="refresh-token",
            ),
        )
    )
    monkeypatch.setattr(auth_router, "login_user", login_mock)

    response = client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "user": {
            "id": "user-1",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "role": "supervisor",
            "team_id": "team-1",
        },
        "access_token": "access-token",
        "refresh_token": "refresh-token",
    }
    login_mock.assert_called_once_with(mock_supabase, "test@example.com", "password123")


def test_logout_calls_service_with_bearer_access_token(
    client: TestClient,
    app,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/logout invokes service logout with the Bearer access token."""
    logout_mock = MagicMock()
    monkeypatch.setattr(auth_router, "logout_user", logout_mock)
    app.dependency_overrides[dependencies.get_current_user] = lambda: {
        "id": "user-1",
        "email": "test@example.com",
    }
    app.dependency_overrides[dependencies.get_bearer_raw_token] = lambda: "access-token"
    try:
        response = client.post("/api/auth/logout")
    finally:
        app.dependency_overrides.pop(dependencies.get_current_user, None)
        app.dependency_overrides.pop(dependencies.get_bearer_raw_token, None)

    assert response.status_code == 204
    logout_mock.assert_called_once_with(mock_supabase, "access-token")


def test_me_returns_current_user_profile(
    client: TestClient,
    mock_supabase: MagicMock,
    current_user_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /api/auth/me returns the current user's profile."""
    current_user_override({"id": "user-1", "email": "test@example.com"})
    me_mock = MagicMock(
        return_value=AuthUser(
            id="user-1",
            email="test@example.com",
            first_name="Test",
            last_name="User",
            role="agent",
            team_id="team-1",
        )
    )
    monkeypatch.setattr(auth_router, "get_current_user_profile", me_mock)

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": "user-1",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "role": "agent",
        "team_id": "team-1",
    }
    me_mock.assert_called_once_with(
        mock_supabase,
        user_id="user-1",
        email="test@example.com",
    )


def test_refresh_requires_refresh_token_in_body(client: TestClient) -> None:
    """POST /api/auth/refresh rejects an empty refresh_token in JSON body."""
    response = client.post("/api/auth/refresh", json={"refresh_token": ""})

    assert response.status_code == 401
    assert response.json() == {"detail": "No refresh token provided"}


def test_refresh_returns_new_tokens_in_body(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/refresh returns new tokens when the refresh token is valid."""
    refresh_mock = MagicMock(
        return_value=AuthTokens(
            access_token="new-access-token",
            refresh_token="new-refresh-token",
        )
    )
    monkeypatch.setattr(auth_router, "refresh_user_tokens", refresh_mock)

    response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "old-refresh-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "access_token": "new-access-token",
        "refresh_token": "new-refresh-token",
    }
    refresh_mock.assert_called_once_with(mock_supabase, "old-refresh-token")


def test_forgot_password_returns_success_message(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/forgot-password always returns the generic success message."""
    forgot_password_mock = MagicMock()
    monkeypatch.setattr(auth_router, "request_password_reset", forgot_password_mock)

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "test@example.com"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "If the email exists, a reset link has been sent"}
    forgot_password_mock.assert_called_once_with(mock_supabase, "test@example.com")


def test_forgot_password_returns_503_for_delivery_failures(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/forgot-password surfaces real delivery failures."""
    monkeypatch.setattr(
        auth_router,
        "request_password_reset",
        MagicMock(side_effect=AuthenticationError("supabase unavailable")),
    )

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "test@example.com"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Password reset is temporarily unavailable"}


def test_reset_password_returns_success_message(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/reset-password returns success when the service succeeds."""
    reset_password_mock = MagicMock()
    monkeypatch.setattr(auth_router, "reset_user_password", reset_password_mock)

    response = client.post(
        "/api/auth/reset-password",
        json={"token": "recovery-token", "new_password": "new-password-123"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password reset successfully"}
    reset_password_mock.assert_called_once_with(
        mock_supabase,
        "recovery-token",
        "new-password-123",
    )


def test_reset_password_returns_auth_error_detail(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/reset-password preserves the explicit token-type error."""
    monkeypatch.setattr(
        auth_router,
        "reset_user_password",
        MagicMock(
            side_effect=AuthenticationError("Invalid token type. Only recovery tokens are allowed.")
        ),
    )

    response = client.post(
        "/api/auth/reset-password",
        json={"token": "bad-token", "new_password": "new-password-123"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token type. Only recovery tokens are allowed."}


def test_change_password_returns_success_message(
    client: TestClient,
    mock_supabase: MagicMock,
    current_user_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PATCH /api/auth/change-password returns success for a valid request."""
    current_user_override({"id": "user-1", "email": "test@example.com"})
    change_password_mock = MagicMock()
    monkeypatch.setattr(auth_router, "change_user_password", change_password_mock)

    response = client.patch(
        "/api/auth/change-password",
        json={
            "current_password": "password123",
            "new_password": "new-password-123",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password changed successfully"}
    change_password_mock.assert_called_once_with(
        mock_supabase,
        user_id="user-1",
        email="test@example.com",
        current_password="password123",
        new_password="new-password-123",
    )


def test_change_password_returns_401_for_invalid_current_password(
    client: TestClient,
    current_user_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PATCH /api/auth/change-password maps auth failures to HTTP 401."""
    current_user_override({"id": "user-1", "email": "test@example.com"})
    monkeypatch.setattr(
        auth_router,
        "change_user_password",
        MagicMock(side_effect=AuthenticationError("Current password is incorrect")),
    )

    response = client.patch(
        "/api/auth/change-password",
        json={
            "current_password": "wrong-password",
            "new_password": "new-password-123",
        },
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Current password is incorrect"}
