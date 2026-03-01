"""Team helpers."""

from .exceptions import ClientError, DatabaseError, NotFoundError


def create_team(client, name: str, supervisor_id: str) -> dict:
    """Create a new team with a supervisor."""
    if client is None:
        raise ClientError("Database client is not initialized")
    try:
        result = (
            client.table("teams").insert({"name": name, "supervisor_id": supervisor_id}).execute()
        )
        return result.data[0]
    except Exception as e:
        raise DatabaseError(f"Failed to create team: {e}")


def get_team_by_id(client, team_id: str) -> dict:
    """Get team by ID."""
    if client is None:
        raise ClientError("Database client is not initialized")
    try:
        result = client.table("teams").select("*").eq("id", team_id).execute()
        if not result.data:
            raise NotFoundError(f"Team {team_id} not found")
        return result.data[0]
    except NotFoundError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to fetch team: {e}")


def get_team_members(client, team_id: str) -> list:
    """Get all users in a team."""
    if client is None:
        raise ClientError("Database client is not initialized")
    try:
        result = client.table("users").select("*").eq("team_id", team_id).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get team members: {e}")


def add_member(client, team_id: str, user_id: str) -> dict:
    """Add a user to a team."""
    if client is None:
        raise ClientError("Database client is not initialized")
    try:
        result = client.table("users").update({"team_id": team_id}).eq("id", user_id).execute()
        if not result.data:
            raise NotFoundError(f"User {user_id} not found")
        return result.data[0]
    except NotFoundError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to add member: {e}")


def remove_member(client, user_id: str) -> dict:
    """Remove a user from their team."""
    if client is None:
        raise ClientError("Database client is not initialized")
    try:
        result = client.table("users").update({"team_id": None}).eq("id", user_id).execute()
        if not result.data:
            raise NotFoundError(f"User {user_id} not found")
        return result.data[0]
    except NotFoundError:
        raise
    except Exception as e:
        raise DatabaseError(f"Failed to remove member: {e}")
