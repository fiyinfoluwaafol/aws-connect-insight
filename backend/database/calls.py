"""Call record helpers."""

from .exceptions import DatabaseError, NotFoundError


def create_call(client, agent_id: str, team_id: str, recording_url: str, duration_seconds: int, started_at: str) -> dict:
    """Create a new call record."""
    try:
        result = client.table("calls").insert({
            "agent_id": agent_id,
            "team_id": team_id,
            "recording_url": recording_url,
            "duration_seconds": duration_seconds,
            "started_at": started_at
        }).execute()
        return result.data[0]
    except Exception as e:
        raise DatabaseError(f"Failed to create call: {e}")


def get_call_by_id(client, call_id: str) -> dict:
    """Get call by ID."""
    try:
        result = client.table("calls").select("*").eq("id", call_id).single().execute()
        return result.data
    except Exception as e:
        raise NotFoundError(f"Call {call_id} not found")


def get_calls_by_agent(client, agent_id: str, limit: int = 10) -> list:
    """Get calls for an agent, most recent first."""
    try:
        result = client.table("calls").select("*").eq("agent_id", agent_id).order("started_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get agent calls: {e}")


def get_calls_by_team(client, team_id: str, limit: int = 10) -> list:
    """Get calls for a team, most recent first."""
    try:
        result = client.table("calls").select("*").eq("team_id", team_id).order("started_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get team calls: {e}")


def get_recent_calls_by_team(client, team_id: str, since: str) -> list:
    """Get calls for a team after a timestamp."""
    try:
        result = client.table("calls").select("*").eq("team_id", team_id).gt("started_at", since).order("started_at", desc=True).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get recent calls: {e}")


def get_calls_in_range_by_team(client, team_id: str, start_date: str, end_date: str) -> list:
    """Get calls for a team within a date range."""
    try:
        result = client.table("calls").select("*").eq("team_id", team_id).gte("started_at", start_date).lte("started_at", end_date).order("started_at", desc=True).execute()
        return result.data
    except Exception as e:
        raise DatabaseError(f"Failed to get calls: {e}")
