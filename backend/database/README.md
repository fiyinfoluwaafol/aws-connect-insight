# Database Helpers

## Setup

Set environment variables:
```
SUPABASE_URL=your-project-url
SUPABASE_KEY=your-anon-key
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

All helpers raise exceptions on failure:
- `NotFoundError` — Record doesn't exist
- `AuthenticationError` — Invalid credentials or token
- `DatabaseError` — Other database errors
- `ClientError` — Supabase client not initialized

---

## auth

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
| `get_user_by_email(client, email)` | user dict |
| `get_users_by_team(client, team_id)` | list |

> **Note:** `role` accepts `Role.AGENT` or `Role.SUPERVISOR` from `database.enums`

## calls

| Function | Returns |
|----------|---------|
| `create_call(client, agent_id, team_id, recording_url, duration_seconds, started_at)` | call dict |
| `get_call_by_id(client, call_id)` | call dict |
| `search_calls(client, team_id, ...)` | `{calls, total}` |

### search_calls options

```python
search_calls(
    client,
    team_id,                # required
    agent_id=None,          # filter by agent
    sentiment=None,         # "positive", "neutral", "negative"
    date_from=None,         # ISO date
    date_to=None,           # ISO date
    topic=None,             # filter by topic
    q=None,                 # keyword search in transcript
    sort="recent",          # "recent", "oldest", "sentiment_asc", "sentiment_desc"
    page=1,
    per_page=20,
)
```

## teams

| Function | Returns |
|----------|---------|
| `create_team(client, name, supervisor_id)` | team dict |
| `get_team_by_id(client, team_id)` | team dict |
