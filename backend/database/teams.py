"""Team helpers."""

from supabase import Client

from .constants import Tables
from .decorators import db_operation
from .exceptions import NotFoundError


@db_operation
def create_team(client: Client, name: str, supervisor_id: str) -> dict:
    """Create a new team with a supervisor."""
    result = (
        client.table(Tables.TEAMS).insert({"name": name, "supervisor_id": supervisor_id}).execute()
    )
    return result.data[0]


@db_operation
def get_team_by_id(client: Client, team_id: str) -> dict:
    """Get a team by ID."""
    result = client.table(Tables.TEAMS).select("*").eq("id", team_id).execute()
    if not result.data:
        raise NotFoundError(f"Team {team_id} not found")
    return result.data[0]


@db_operation
def add_agent_to_team(client: Client, agent_id: str, team_id: str) -> dict:
    """Add an agent to a team."""
    result = client.table(Tables.USERS).update({"team_id": team_id}).eq("id", agent_id).execute()
    if not result.data:
        raise NotFoundError(f"Agent {agent_id} not found")
    return result.data[0]
