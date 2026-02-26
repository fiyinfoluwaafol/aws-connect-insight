# Database

## Setup

Set these environment variables:

```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage

```python
from database import auth, users, teams, calls
from database.exceptions import NotFoundError, AuthenticationError, DatabaseError

# Direct client access (if needed)
from database.client import get_client
supabase = get_client()
```

All functions return data directly. On failure, they raise `NotFoundError`, `AuthenticationError`, or `DatabaseError`.

---

## auth

| Function | Returns |
|----------|---------|
| `create_auth_user(email, password)` | `{id, email}` |
| `authenticate_user(email, password)` | `{user, session}` |
| `get_current_user(access_token)` | `{id, email}` |
| `sign_out(access_token)` | `True` |

## users

| Function | Returns |
|----------|---------|
| `create_user(user_id, email, first_name, last_name, role, team_id=None)` | user dict |
| `get_user_by_id(user_id)` | user dict |
| `get_user_by_email(email)` | user dict |
| `get_users_by_team(team_id)` | list |

## teams

| Function | Returns |
|----------|---------|
| `create_team(name, supervisor_id)` | team dict |
| `get_team_by_id(team_id)` | team dict |
| `get_team_members(team_id)` | list |
| `add_member(team_id, user_id)` | user dict |
| `remove_member(user_id)` | user dict |

## calls

| Function | Returns |
|----------|---------|
| `create_call(agent_id, team_id, recording_url, duration_seconds, started_at)` | call dict |
| `get_call_by_id(call_id)` | call dict |
| `get_calls_by_agent(agent_id, limit=10)` | list |
| `get_calls_by_team(team_id, limit=10)` | list |
| `get_recent_calls(team_id, since)` | list |
| `get_calls_in_range(team_id, start_date, end_date)` | list |
