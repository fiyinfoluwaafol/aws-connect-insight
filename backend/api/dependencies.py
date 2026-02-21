"""FastAPI dependency injection - DI seam for test overrides."""

from collections.abc import Generator
from typing import Any

from api.config import Settings, get_settings


def get_supabase_client() -> Generator[Any, None, None]:
    """Yield Supabase client. Override in tests for mocking."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        yield None
        return

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_key)
    yield client
