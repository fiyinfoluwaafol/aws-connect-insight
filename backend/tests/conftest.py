"""Shared pytest fixtures - app with DI overrides, TestClient."""

from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api.main import create_app


@pytest.fixture
def mock_supabase() -> MagicMock:
    """Mock Supabase client for unit/API tests."""
    return MagicMock()


@pytest.fixture
def app(mock_supabase: MagicMock):
    """FastAPI app with Supabase dependency overridden."""
    from api.main import app as _app

    def _override_get_supabase_client():
        yield mock_supabase

    from api import dependencies

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    return _app


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    """HTTP test client for API tests."""
    with TestClient(app) as c:
        yield c
