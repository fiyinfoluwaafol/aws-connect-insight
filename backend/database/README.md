# Database

## Setup

Set these environment variables for the `get_supabase_client`in the api dependencies:

```
SUPABASE_URL=xxxx
SUPABASE_KEY=xxx
```

## Usage

All helpers accept `client` as the first parameter:

```python
from fastapi import Depends
from api.dependencies import get_supabase_client
from database import auth, users, teams, calls

@router.post("/signup")
async def signup(email: str, password: str, client = Depends(get_supabase_client)):
    auth_user = auth.create_auth_user(client, email, password)
    user = users.create_user(client, auth_user["id"], email, "John", "Doe", "agent")
    return user
```

On failure, functions raise `NotFoundError`, `AuthenticationError`, or `DatabaseError`, so please handle errors accordingly.

**Also Note:** Auth User is seperate from the user table in supabase so after an auth user is created using `create_auth_user()`, a database entry for the user should then be created using `create_user()` This is demonstrated in the above example.

---

## auth


| Function                                     | Returns           |
| -------------------------------------------- | ----------------- |
| `create_auth_user(client, email, password)`  | `{id, email}`     |
| `authenticate_user(client, email, password)` | `{user, session}` |
| `get_current_user(client, access_token)`     | `{id, email}`     |
| `sign_out(client, access_token)`             | `True`            |


## users


| Function                                                                         | Returns   |
| -------------------------------------------------------------------------------- | --------- |
| `create_user(client, user_id, email, first_name, last_name, role, team_id=None)` | user dict |
| `get_user_by_id(client, user_id)`                                                | user dict |
| `get_user_by_email(client, email)`                                               | user dict |
| `get_users_by_team(client, team_id)`                                             | list      |


## teams


| Function                                   | Returns   |
| ------------------------------------------ | --------- |
| `create_team(client, name, supervisor_id)` | team dict |
| `get_team_by_id(client, team_id)`          | team dict |
| `get_team_members(client, team_id)`        | list      |
| `add_member(client, team_id, user_id)`     | user dict |
| `remove_member(client, user_id)`           | user dict |


## calls


| Function                                                                              | Returns   |
| ------------------------------------------------------------------------------------- | --------- |
| `create_call(client, agent_id, team_id, recording_url, duration_seconds, started_at)` | call dict |
| `get_call_by_id(client, call_id)`                                                     | call dict |
| `get_calls_by_agent(client, agent_id, limit=10)`                                      | list      |
| `get_calls_by_team(client, team_id, limit=10)`                                        | list      |
| `get_recent_calls_by_team(client, team_id, since)`                                    | list      |
| `get_calls_in_range_by_team(client, team_id, start_date, end_date)`                   | list      |


