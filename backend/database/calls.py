"""Call record helpers."""

from datetime import datetime, timedelta

from supabase import Client

from .constants import SortOrder, Tables
from .decorators import db_operation
from .exceptions import NotFoundError

MAX_PER_PAGE = 100


@db_operation
def create_call(
    client: Client,
    agent_id: str,
    team_id: str,
    recording_url: str,
    duration_seconds: int,
    started_at: str,
    transcript: list[dict] | None = None,
) -> dict:
    """
    Create a new call record.

    started_at: ISO timestamp
    """
    payload = {
        "agent_id": agent_id,
        "team_id": team_id,
        "recording_url": recording_url,
        "duration_seconds": duration_seconds,
        "started_at": started_at,
    }
    if transcript is not None:
        payload["transcript"] = transcript

    result = (
        client.table(Tables.CALLS)
        .insert(payload)
        .execute()
    )
    return result.data[0]


@db_operation
def update_call_transcript(client: Client, call_id: str, transcript: list[dict]) -> dict:
    """
    Update a call with transcript.

    transcript: List of {speaker, text} dicts
    """
    result = (
        client.table(Tables.CALLS).update({"transcript": transcript}).eq("id", call_id).execute()
    )
    if not result.data:
        raise NotFoundError(f"Call {call_id} not found")
    return result.data[0]


@db_operation
def get_call_by_id(client: Client, call_id: str) -> dict:
    """Get a call by ID with its analysis (null if not yet analyzed)."""
    result = (
        client.table(Tables.CALLS)
        .select(f"*, {Tables.CALL_ANALYSES}(*)")
        .eq("id", call_id)
        .execute()
    )
    if not result.data:
        raise NotFoundError(f"Call {call_id} not found")
    return result.data[0]


@db_operation
def search_calls(
    client: Client,
    team_id: str,
    agent_id: str = None,
    date_from: str = None,
    date_to: str = None,
    sort: SortOrder = SortOrder.RECENT,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """
    Search calls with filters. Returns {calls, total}.

    page: min 1
    per_page: max 100

    TODO: sentiment filter/sort (needs calls_with_analysis view)
    """
    if page < 1:
        page = 1
    per_page = min(per_page, MAX_PER_PAGE)

    query = (
        client.table(Tables.CALLS)
        .select(f"*, {Tables.CALL_ANALYSES}(*)", count="exact")
        .eq("team_id", team_id)
    )

    if agent_id is not None:
        query = query.eq("agent_id", agent_id)
    if date_from is not None:
        query = query.gte("started_at", date_from)
    if date_to is not None:
        next_day = (datetime.fromisoformat(date_to) + timedelta(days=1)).strftime("%Y-%m-%d")
        query = query.lt("started_at", next_day)

    if sort == SortOrder.OLDEST:
        query = query.order("started_at", desc=False)
    else:
        # Defaults to recent order
        query = query.order("started_at", desc=True)

    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    result = query.execute()
    return {"calls": result.data, "total": result.count}
