"""Team helpers."""

from supabase import Client

from .constants import Tables
from .exceptions import NotFoundError
from .utils import with_db_client


@with_db_client
def create_team(client: Client, name: str, supervisor_id: str) -> dict:
    """Create a new team with a supervisor."""
    result = (
        client.table(Tables.TEAMS)
        .insert({"name": name, "supervisor_id": supervisor_id})
        .execute()
    )
    return result.data[0]


@with_db_client
def get_team_by_id(client: Client, team_id: str) -> dict:
    """Get team by ID."""
    result = client.table(Tables.TEAMS).select("*").eq("id", team_id).execute()
    if not result.data:
        raise NotFoundError(f"Team {team_id} not found")
    return result.data[0]
