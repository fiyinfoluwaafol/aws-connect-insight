"""Call record helpers."""

from supabase import Client

from .constants import Tables
from .exceptions import NotFoundError
from .utils import with_db_client


@with_db_client
def create_call(
    client: Client,
    agent_id: str,
    team_id: str,
    recording_url: str,
    duration_seconds: int,
    started_at: str,
) -> dict:
    """Create a new call record."""
    result = (
        client.table(Tables.CALLS)
        .insert(
            {
                "agent_id": agent_id,
                "team_id": team_id,
                "recording_url": recording_url,
                "duration_seconds": duration_seconds,
                "started_at": started_at,
            }
        )
        .execute()
    )
    return result.data[0]


@with_db_client
def get_call_by_id(client: Client, call_id: str) -> dict:
    """Get call by ID."""
    result = client.table(Tables.CALLS).select("*").eq("id", call_id).execute()
    if not result.data:
        raise NotFoundError(f"Call {call_id} not found")
    return result.data[0]


@with_db_client
def search_calls(
    client: Client,
    team_id: str,
    agent_id: str = None,
    sentiment: str = None,
    date_from: str = None,
    date_to: str = None,
    topic: str = None,
    q: str = None,
    sort: str = "recent",
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Search calls with optional filters."""
    query = (
        client.table(Tables.CALLS)
        .select("*", count="exact")
        .eq("team_id", team_id)
    )

    if agent_id:
        query = query.eq("agent_id", agent_id)
    if sentiment:
        query = query.eq("sentiment_label", sentiment)
    if date_from:
        query = query.gte("started_at", date_from)
    if date_to:
        query = query.lte("started_at", date_to)
    if topic:
        query = query.contains("topics", [topic])
    if q:
        query = query.ilike("transcript", f"%{q}%")

    # Sorting
    if sort == "recent":
        query = query.order("started_at", desc=True)
    elif sort == "oldest":
        query = query.order("started_at", desc=False)
    elif sort == "sentiment_asc":
        query = query.order("sentiment_score", desc=False)
    elif sort == "sentiment_desc":
        query = query.order("sentiment_score", desc=True)

    # Pagination
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    result = query.execute()
    return {"calls": result.data, "total": result.count}
