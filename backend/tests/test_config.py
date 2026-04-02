"""Unit tests for config loading."""

import pytest

from api.config import Settings, get_settings


def test_settings_defaults_when_env_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings use empty strings when env vars not set."""
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    # Use _env_file=None to prevent Pydantic from reading the actual .env file during this test
    settings = Settings(_env_file=None)
    assert settings.supabase_url == ""
    assert settings.supabase_service_role_key == ""
    assert settings.openai_api_key == ""


def test_settings_load_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings load SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment."""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    settings = Settings(_env_file=None)
    assert settings.supabase_url == "https://test.supabase.co"
    assert settings.supabase_service_role_key == "test-service-role-key"
    assert settings.openai_api_key == "test-openai-key"


def test_get_settings_returns_settings_instance() -> None:
    """get_settings returns a Settings instance."""
    settings = get_settings()
    assert isinstance(settings, Settings)


def test_is_production_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    """is_production returns True only when ENVIRONMENT=production."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    settings = Settings()
    assert not settings.is_production

    monkeypatch.setenv("ENVIRONMENT", "production")
    settings = Settings()
    assert settings.is_production
