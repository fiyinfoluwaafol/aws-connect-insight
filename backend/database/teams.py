"""Team helpers."""

from .client import get_client
from .exceptions import DatabaseError, NotFoundError


def create_team(name: str, supervisor_id: str) -> dict:
    """Create a new team with a supervisor."""
    try:
        supabase = get_client()
        result = supabase.table("teams").insert({
            "name": name,
            "supervisor_id": supervisor_id
        }).execute()
        return result.data[0]
    except Exception as e:
        raise DatabaseError(f"Failed to create team: {e}")


def get_team_by_id(team_id: str) -> dict:
    """Get team by ID."""
    try:
        supabase = get_client()
        result = supabase.table("teams").select("*").eq("id", team_id).single().execute()
        return result.data
    except Exception as e:
        raise NotFoundError(f"Team {team_id} not found")


def get_team_members(team_id: str) -> list:
    """Get all users in a team."""
    try:
        supabase = get_client()
        result = supabase.table("users").select("*").eq("team_id", team_id).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get team members: {e}")


def add_member(team_id: str, user_id: str) -> dict:
    """Add a user to a team."""
    try:
        supabase = get_client()
        result = supabase.table("users").update({"team_id": team_id}).eq("id", user_id).execute()
        if not result.data:
            raise NotFoundError(f"User {user_id} not found")
        return result.data[0]
    except NotFoundError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to add member: {e}")


def remove_member(user_id: str) -> dict:
    """Remove a user from their team."""
    try:
        supabase = get_client()
        result = supabase.table("users").update({"team_id": None}).eq("id", user_id).execute()
        if not result.data:
            raise NotFoundError(f"User {user_id} not found")
        return result.data[0]
    except NotFoundError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to remove member: {e}")
