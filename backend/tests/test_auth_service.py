"""Unit tests for the authentication service layer."""

from unittest.mock import MagicMock

import pytest

from database.exceptions import AuthenticationError, DatabaseError
from services import auth as auth_service


def test_register_user_rolls_back_auth_user_when_profile_creation_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed profile insert should delete the auth user that was just created."""
    deleted_user_ids: list[str] = []

    monkeypatch.setattr(
        auth_service,
        "create_auth_user",
        lambda client, email, password: {"id": "user-1", "email": email},
    )

    def _fail_create_user(*args, **kwargs):
        raise DatabaseError("create_user failed: profile insert failed")

    monkeypatch.setattr(auth_service, "create_user", _fail_create_user)
    monkeypatch.setattr(
        auth_service,
        "delete_auth_user",
        lambda client, user_id: deleted_user_ids.append(user_id) or True,
    )

    with pytest.raises(DatabaseError, match="profile insert failed"):
        auth_service.register_user(
            MagicMock(),
            email="test@example.com",
            password="password123",
            first_name="Test",
            last_name="User",
            role="agent",
        )

    assert deleted_user_ids == ["user-1"]


def test_login_user_returns_profile_and_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    """login_user should combine auth tokens with the stored profile."""
    monkeypatch.setattr(
        auth_service,
        "authenticate_user",
        lambda client, email, password: {
            "user_id": "user-1",
            "email": email,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
        },
    )
    monkeypatch.setattr(
        auth_service,
        "_get_user_profile",
        lambda client, user_id: {
            "first_name": "Test",
            "last_name": "User",
            "role": "supervisor",
            "team_id": "team-1",
        },
    )

    result = auth_service.login_user(MagicMock(), "test@example.com", "password123")

    assert result.user.id == "user-1"
    assert result.user.email == "test@example.com"
    assert result.user.first_name == "Test"
    assert result.user.last_name == "User"
    assert result.user.role == "supervisor"
    assert result.user.team_id == "team-1"
    assert result.tokens.access_token == "access-token"
    assert result.tokens.refresh_token == "refresh-token"


def test_reset_user_password_rejects_non_recovery_tokens() -> None:
    """reset_user_password should only accept recovery-style tokens."""
    with pytest.raises(AuthenticationError, match="Invalid token type"):
        auth_service.reset_user_password(MagicMock(), "not-a-jwt", "new-password")
