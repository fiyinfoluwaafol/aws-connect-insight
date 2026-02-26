"""User profile helpers."""

from .exceptions import DatabaseError, NotFoundError


def create_user(client, user_id: str, email: str, first_name: str, last_name: str, role: str, team_id: str = None) -> dict:
    """Create a user profile."""
    try:
        data = {
            "id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": role
        }
        if team_id:
            data["team_id"] = team_id

        result = client.table("users").insert(data).execute()
        return result.data[0]
    except Exception as e:
        raise DatabaseError(f"Failed to create user: {e}")


def get_user_by_id(client, user_id: str) -> dict:
    """Get user by ID."""
    try:
        result = client.table("users").select("*").eq("id", user_id).single().execute()
        return result.data
    except Exception as e:
        raise NotFoundError(f"User {user_id} not found")


def get_user_by_email(client, email: str) -> dict:
    """Get user by email."""
    try:
        result = client.table("users").select("*").eq("email", email).single().execute()
        return result.data
    except Exception as e:
        raise NotFoundError(f"User with email {email} not found")


def get_users_by_team(client, team_id: str) -> list:
    """Get all users in a team."""
    try:
        result = client.table("users").select("*").eq("team_id", team_id).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get team users: {e}")
