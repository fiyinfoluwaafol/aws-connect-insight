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


def _set_cookie_headers(response) -> list[str]:
    """Return all Set-Cookie headers on the response."""
    return response.headers.get_list("set-cookie")


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


def test_login_sets_auth_cookies(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/login returns the user and sets auth cookies."""
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
        "id": "user-1",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "role": "supervisor",
        "team_id": "team-1",
    }
    cookies = _set_cookie_headers(response)
    assert any("access_token=access-token" in header for header in cookies)
    assert any("refresh_token=refresh-token" in header for header in cookies)
    login_mock.assert_called_once_with(mock_supabase, "test@example.com", "password123")


def test_logout_clears_auth_cookies(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/logout clears cookies and attempts service logout."""
    logout_mock = MagicMock()
    monkeypatch.setattr(auth_router, "logout_user", logout_mock)
    client.cookies.set("access_token", "access-token")
    client.cookies.set("refresh_token", "refresh-token")

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    cookies = _set_cookie_headers(response)
    assert any("access_token=" in header and "Max-Age=0" in header for header in cookies)
    assert any("refresh_token=" in header and "Max-Age=0" in header for header in cookies)
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


def test_refresh_requires_refresh_cookie(client: TestClient) -> None:
    """POST /api/auth/refresh requires the refresh_token cookie."""
    response = client.post("/api/auth/refresh")

    assert response.status_code == 401
    assert response.json() == {"detail": "No refresh token provided"}


def test_refresh_sets_new_auth_cookies(
    client: TestClient,
    mock_supabase: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/auth/refresh rotates cookies when the token is valid."""
    refresh_mock = MagicMock(
        return_value=AuthTokens(
            access_token="new-access-token",
            refresh_token="new-refresh-token",
        )
    )
    monkeypatch.setattr(auth_router, "refresh_user_tokens", refresh_mock)
    client.cookies.set("refresh_token", "old-refresh-token")

    response = client.post("/api/auth/refresh")

    assert response.status_code == 200
    assert response.json() == {"message": "Token refreshed successfully"}
    cookies = _set_cookie_headers(response)
    assert any("access_token=new-access-token" in header for header in cookies)
    assert any("refresh_token=new-refresh-token" in header for header in cookies)
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
    assert response.json() == {
        "message": "If the email exists, a reset link has been sent"
    }
    forgot_password_mock.assert_called_once_with(mock_supabase, "test@example.com")


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
            side_effect=AuthenticationError(
                "Invalid token type. Only recovery tokens are allowed."
            )
        ),
    )

    response = client.post(
        "/api/auth/reset-password",
        json={"token": "bad-token", "new_password": "new-password-123"},
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Invalid token type. Only recovery tokens are allowed."
    }


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
