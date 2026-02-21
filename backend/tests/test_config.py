"""Unit tests for config loading."""

import os

import pytest

from api.config import Settings, get_settings


def test_settings_defaults_when_env_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings use empty strings when env vars not set."""
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    settings = Settings()
    assert settings.supabase_url == ""
    assert settings.supabase_key == ""


def test_settings_load_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings load SUPABASE_URL and SUPABASE_KEY from environment."""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-anon-key")
    settings = Settings()
    assert settings.supabase_url == "https://test.supabase.co"
    assert settings.supabase_key == "test-anon-key"


def test_get_settings_returns_settings_instance() -> None:
    """get_settings returns a Settings instance."""
    settings = get_settings()
    assert isinstance(settings, Settings)
