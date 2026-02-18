"""Integration test fixtures - Supabase/Postgres via docker-compose.

Usage:
  1. Start test stack: docker compose -f docker-compose.test.yml up -d
  2. Run migrations (when backend/migrations/ exists)
  3. Run tests: pytest tests/integration/

Each test should use transaction rollback for deterministic cleanup.
"""

import os

import pytest


@pytest.fixture(scope="session")
def db_url() -> str:
    """Postgres connection URL for integration tests."""
    return os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://test:test@localhost:5433/aws_connect_insight_test",
    )


@pytest.fixture
def db_connection(db_url: str):
    """Connection with transaction rollback for deterministic cleanup.

    Phase 2: Implement with psycopg or asyncpg, wrap each test in
    a transaction that rolls back.
    """
    pytest.skip("DB integration tests - Phase 2. Start postgres via docker-compose.test.yml")
