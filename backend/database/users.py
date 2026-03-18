"""User profile helpers."""

from supabase import Client

from .constants import Tables
from .enums import Role
from .exceptions import NotFoundError
from .utils import with_db_client


@with_db_client
def create_user(
    client: Client,
    user_id: str,
    email: str,
    first_name: str,
    last_name: str,
    role: Role,
    team_id: str = None,
) -> dict:
    """Create a user profile."""
    data = {
        "id": user_id,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "role": role.value,
    }
    if team_id:
        data["team_id"] = team_id

    result = client.table(Tables.USERS).insert(data).execute()
    return result.data[0]


@with_db_client
def get_user_by_id(client: Client, user_id: str) -> dict:
    """Get user by ID."""
    result = client.table(Tables.USERS).select("*").eq("id", user_id).execute()
    if not result.data:
        raise NotFoundError(f"User {user_id} not found")
    return result.data[0]


@with_db_client
def get_user_by_email(client: Client, email: str) -> dict:
    """Get user by email."""
    result = client.table(Tables.USERS).select("*").eq("email", email).execute()
    if not result.data:
        raise NotFoundError(f"User with email {email} not found")
    return result.data[0]


@with_db_client
def get_users_by_team(client: Client, team_id: str) -> list:
    """Get all users in a team."""
    result = client.table(Tables.USERS).select("*").eq("team_id", team_id).execute()
    return result.data
