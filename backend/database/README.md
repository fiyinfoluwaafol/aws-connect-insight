# Database Helpers

## Setup

Set environment variables:
```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Quick Start

```python
from fastapi import Depends
from api.dependencies import get_supabase_client
from database import auth, users

@router.post("/signup")
def signup(email: str, password: str, client = Depends(get_supabase_client)):
    auth_user = auth.create_auth_user(client, email, password)
    user = users.create_user(client, auth_user["id"], email, "John", "Doe", Role.AGENT)
    return user
```

> **Note:** Auth users and profile users are separate in Supabase. After `create_auth_user()`, always call `create_user()` to create the profile.

## Error Handling

Helpers raise specific exceptions on failure:

| Module | Decorator | Exception |
|--------|-----------|-----------|
| `auth` | `@auth_operation` | `AuthenticationError` |
| `users`, `calls`, `teams` | `@db_operation` | `DatabaseError` |

Other exceptions:
- `NotFoundError` — Record doesn't exist
- `ClientError` — Supabase client not initialized

---

## auth

> All auth functions raise `AuthenticationError` on failure.

| Function | Returns |
|----------|---------|
| `create_auth_user(client, email, password)` | `{id, email}` |
| `authenticate_user(client, email, password)` | `{user, session}` |
| `get_current_user(client, access_token)` | `{id, email}` |
| `sign_out(client, access_token)` | `True` |

## users

| Function | Returns |
|----------|---------|
| `create_user(client, user_id, email, first_name, last_name, role, team_id?)` | user dict |
| `get_user_by_id(client, user_id)` | user dict |
| `get_users_by_team(client, team_id)` | list |

> **Note:** `role` accepts `Role.AGENT` or `Role.SUPERVISOR` from `database.constants`

## calls

| Function | Returns |
|----------|---------|
| `create_call(client, agent_id, team_id, recording_url, duration_seconds, started_at)` | call dict |
| `update_call_transcript(client, call_id, transcript)` | call dict |
| `get_call_by_id(client, call_id)` | call dict + `call_analyses` |
| `search_calls(client, team_id, ...)` | `{calls, total}` |

> **Note:** `transcript` is a list of `{speaker, text}` dicts. Add it via `update_call` after transcription completes.

### search_calls options

```python
search_calls(
    client,
    team_id,                      # required
    agent_id=None,                # filter by agent
    date_from=None,               # ISO date
    date_to=None,                 # ISO date
    sort=SortOrder.RECENT,        # SortOrder.RECENT or SortOrder.OLDEST
    page=1,
    per_page=20,                  # max 100
)
# TODO: sentiment filter/sort (needs calls_with_analysis view)
# TODO: topic filter, keyword search
```

> **Note:** `SortOrder` is imported from `database.constants`

## teams

| Function | Returns |
|----------|---------|
| `create_team(client, name, supervisor_id)` | team dict |
| `get_team_by_id(client, team_id)` | team dict |
| `add_agent_to_team(client, agent_id, team_id)` | user dict |
