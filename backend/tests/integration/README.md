# DB Integration Tests

Run integration tests against a local Supabase/Postgres stack.

## Prerequisites

- Docker and Docker Compose
- `docker-compose.test.yml` at repo root

## Setup

```bash
# From repo root
docker compose -f docker-compose.test.yml up -d

# Wait for Postgres to be ready, then run migrations (when available)
# cd backend && python -m scripts.run_migrations  # Phase 2
```

## Run

```bash
cd backend
pytest tests/integration/ -v
```

## Cleanup

Tests use transaction rollback for deterministic state. To tear down:

```bash
docker compose -f docker-compose.test.yml down
```
