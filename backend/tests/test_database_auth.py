"""Unit tests for low-level auth helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from database import auth as auth_helpers


def test_verify_user_password_uses_isolated_client(monkeypatch) -> None:
    """Password verification should not sign in on the shared admin client."""
    shared_client = MagicMock()
    shared_client.supabase_url = "https://example.supabase.co"
    shared_client.supabase_key = "service-role-key"

    isolated_client = MagicMock()
    isolated_client.auth.sign_in_with_password.return_value = SimpleNamespace(user=object())

    create_client_mock = MagicMock(return_value=isolated_client)
    monkeypatch.setattr(auth_helpers, "create_client", create_client_mock)

    assert auth_helpers.verify_user_password(shared_client, "test@example.com", "password123")

    create_client_mock.assert_called_once_with(
        "https://example.supabase.co",
        "service-role-key",
    )
    isolated_client.auth.sign_in_with_password.assert_called_once_with(
        {"email": "test@example.com", "password": "password123"}
    )
    shared_client.auth.sign_in_with_password.assert_not_called()
