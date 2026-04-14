"""Call endpoints for agents and supervisors."""

import logging
import random
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.config import Settings, get_settings
from api.dependencies import get_current_user, get_supabase_client
from database.alerts import get_open_alert_for_call
from database.analysis import (
    add_keywords_to_analysis,
    add_topics_to_analysis,
    create_analysis,
    get_analysis_by_call_id,
)
from database.calls import create_call, search_calls
from database.calls import get_call_by_id as fetch_call_by_id
from database.constants import SortOrder, Tables
from database.exceptions import DatabaseError, NotFoundError
from database.sample_transcripts import get_random_sample_transcript
from database.teams import get_team_by_id
from database.users import get_user_by_id
from services.alerts import evaluate_alert_rules_for_call
from services.transcript_analysis import (
    DEFAULT_ANALYSIS_MODEL,
    AnalysisServiceError,
    analyze_transcript_with_openai,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# Response Models
# =============================================================================


class SimulateCallTranscriptTurn(BaseModel):
    """A single transcript turn in the simulate call response."""

    speaker: str
    text: str


class SimulateCallResponse(BaseModel):
    """Response for simulated call creation."""

    call_id: str
    transcript: list[SimulateCallTranscriptTurn]
    sentiment_score: float
    sentiment_label: str
    summary: str
    key_moves: list[str]
    is_resolved: bool
    topics: list[str]
    keywords: dict[str, bool]


class CallDetailTranscriptTurn(BaseModel):
    """A transcript turn returned for supervisor call detail views."""

    speaker: str
    text: str
    timestamp: str | None = None


class CallDetailResponse(BaseModel):
    """Detailed call payload used by the supervisor alerts workflow."""

    id: str
    agent_id: str
    agent_name: str
    started_at: str | None = None
    duration_seconds: int | None = None
    sentiment_score: float | None = None
    sentiment_label: str | None = None
    is_resolved: bool | None = None
    topics: list[str]
    keywords: list[str] = []
    summary: str | None = None
    transcript: list[CallDetailTranscriptTurn]
    has_open_alert: bool = False
    open_alert_id: str | None = None


class CallSearchItem(BaseModel):
    """A minimal call representation returned in search results."""

    id: str
    agent_id: str
    agent_name: str
    started_at: str | None = None
    duration_seconds: int | None = None
    sentiment_score: float | None = None
    sentiment_label: str | None = None
    topics: list[str]
    summary: str | None = None


class CallSearchResponse(BaseModel):
    """Payload for the calls search endpoint."""

    calls: list[CallSearchItem]
    total: int
    page: int
    per_page: int


# =============================================================================
# Helper Functions
# =============================================================================


def _require_client(client: Any) -> Any:
    """Ensure the database client is available."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )
    return client


def _get_user_team_id(current_user: dict) -> str:
    """Extract team_id from current user, raising if not available."""
    team_id = current_user.get("team_id")
    if not team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a team",
        )
    return team_id


def normalize_transcript(turns: Any) -> list[dict[str, str]]:
    """Normalize transcript turns from the sample pool into the calls table shape."""
    if not isinstance(turns, list):
        return []

    normalized_turns: list[dict[str, str]] = []
    for turn in turns:
        if not isinstance(turn, dict):
            continue

        speaker = str(turn.get("speaker", "")).strip()
        text = str(turn.get("text", "")).strip()
        if speaker and text:
            normalized_turns.append({"speaker": speaker, "text": text})

    return normalized_turns


def _get_supervisor_id_for_call_metadata(
    db_client: Any,
    current_user: dict,
    team_id: str,
) -> str | None:
    """Resolve the supervisor whose alert state should decorate call detail payloads."""
    if current_user.get("role") == "supervisor":
        return current_user.get("id")

    team = get_team_by_id(db_client, team_id)
    return team.get("supervisor_id")


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/", response_model=CallSearchResponse)
def get_calls(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
    q: str | None = None,
    agent_id: str | None = None,
    sentiment_min: float | None = None,
    sentiment_max: float | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    topic: str | None = None,
    sort: str = "recent",
    page: int = 1,
    per_page: int = 20,
) -> CallSearchResponse:
    """Retrieve conversations that match selected filters."""
    db_client = _require_client(client)
    team_id = _get_user_team_id(current_user)

    try:
        sort_enum = SortOrder(sort)
    except ValueError:
        # Fallback to recent if an invalid sort string is provided
        sort_enum = SortOrder.RECENT

    try:
        search_result = search_calls(
            client=db_client,
            team_id=team_id,
            agent_id=agent_id,
            date_from=date_from,
            date_to=date_to,
            sentiment_min=sentiment_min,
            sentiment_max=sentiment_max,
            keyword=q,
            topic=topic,
            sort=sort_enum,
            page=page,
            per_page=per_page,
        )

        calls_data = search_result.get("calls", [])
        total = search_result.get("total", 0)

        formatted_calls = []
        for call in calls_data:
            agent_details = (
                get_user_by_id(db_client, call["agent_id"]) if call.get("agent_id") else {}
            )
            agent_name_parts = [agent_details.get("first_name"), agent_details.get("last_name")]
            agent_name = " ".join(part for part in agent_name_parts if part) or agent_details.get(
                "email", "Unknown Agent"
            )

            analysis = call.get(Tables.CALL_ANALYSES, {})

            if isinstance(analysis, list) and analysis:
                analysis = analysis[0]
            elif isinstance(analysis, list):
                analysis = {}

            # Extract topics from junction table if present
            topics = []
            for t in analysis.get(Tables.CALL_ANALYSIS_TOPICS, []):
                topic_data = t.get(Tables.TOPICS)
                if topic_data and isinstance(topic_data, dict):
                    name = topic_data.get("name")
                    if name:
                        topics.append(name)

            formatted_calls.append(
                CallSearchItem(
                    id=call["id"],
                    agent_id=call["agent_id"],
                    agent_name=agent_name,
                    started_at=call.get("started_at"),
                    duration_seconds=call.get("duration_seconds"),
                    sentiment_score=analysis.get("sentiment_score"),
                    sentiment_label=analysis.get("sentiment_label"),
                    topics=topics,
                    summary=analysis.get("summary"),
                )
            )

        return CallSearchResponse(
            calls=formatted_calls,
            total=total,
            page=page,
            per_page=per_page,
        )

    except DatabaseError as exc:
        logger.error(f"Database error during call search: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search calls",
        ) from exc


@router.get("/{call_id}", response_model=CallDetailResponse)
def get_call_detail(
    call_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> CallDetailResponse:
    """Return a single call with enough detail for supervisor alert investigation."""
    db_client = _require_client(client)
    team_id = _get_user_team_id(current_user)

    try:
        call = fetch_call_by_id(db_client, call_id)
        if call.get("team_id") != team_id:
            raise NotFoundError(f"Call {call_id} not found")

        agent = get_user_by_id(db_client, call["agent_id"])
        supervisor_id = _get_supervisor_id_for_call_metadata(db_client, current_user, team_id)
        try:
            analysis = get_analysis_by_call_id(db_client, call_id)
        except NotFoundError:
            analysis = None

        open_alert = None
        if supervisor_id:
            open_alert = get_open_alert_for_call(
                db_client,
                call_id=call_id,
                team_id=team_id,
                supervisor_id=supervisor_id,
            )

        transcript = normalize_transcript(call.get("transcript"))

        topics = analysis.get("topics", []) if analysis else []
        keywords = analysis.get("keywords", []) if analysis else []

        return CallDetailResponse(
            id=call["id"],
            agent_id=call["agent_id"],
            agent_name=" ".join(
                part for part in [agent.get("first_name"), agent.get("last_name")] if part
            )
            or agent.get("email", "Unknown Agent"),
            started_at=call.get("started_at"),
            duration_seconds=call.get("duration_seconds"),
            sentiment_score=analysis.get("sentiment_score") if analysis else None,
            sentiment_label=analysis.get("sentiment_label") if analysis else None,
            is_resolved=analysis.get("is_resolved") if analysis else None,
            topics=topics,
            keywords=keywords,
            summary=analysis.get("summary") if analysis else None,
            transcript=[CallDetailTranscriptTurn(**turn) for turn in transcript],
            has_open_alert=open_alert is not None,
            open_alert_id=open_alert.get("id") if open_alert else None,
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch call",
        ) from exc


@router.post("/simulate", response_model=SimulateCallResponse)
def simulate_call(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SimulateCallResponse:
    """
    Simulate a call for the current agent.

    Creates a realistic call record with a seeded transcript and AI-driven analysis.
    Used for testing and demo purposes.

    Requires authentication and team assignment.
    """
    db_client = _require_client(client)
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis service unavailable",
        )

    agent_id = current_user.get("id")
    team_id = _get_user_team_id(current_user)

    # UTC so clients can parse unambiguously; Date#toLocaleString() then shows the user's local time correctly.
    call_time = datetime.now(timezone.utc)
    duration = random.randint(120, 1200)  # 2-20 minutes

    try:
        sample_transcript = get_random_sample_transcript(db_client)
        transcript = normalize_transcript(sample_transcript.get("transcript"))
        if not transcript:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No usable sample transcripts found",
            )

        analysis_result = analyze_transcript_with_openai(
            transcript,
            model=DEFAULT_ANALYSIS_MODEL,
            api_key=settings.openai_api_key,
        )

        # Create call record
        call = create_call(
            db_client,
            agent_id=agent_id,
            team_id=team_id,
            recording_url=f"https://example.com/recordings/call-{random.randint(10000, 99999)}.mp3",
            duration_seconds=duration,
            started_at=call_time.isoformat(),
            transcript=transcript,
        )

        # Create call analysis
        analysis = create_analysis(
            db_client,
            call_id=call["id"],
            summary=analysis_result.summary,
            sentiment_score=analysis_result.sentiment_score,
            sentiment_label=analysis_result.sentiment_label,
            key_moves=analysis_result.key_moves,
            is_resolved=analysis_result.is_resolved,
        )

        if analysis_result.topics:
            add_topics_to_analysis(db_client, analysis["id"], analysis_result.topics)
        if analysis_result.keywords:
            add_keywords_to_analysis(
                db_client,
                analysis["id"],
                list(analysis_result.keywords.keys()),
            )

        try:
            team = get_team_by_id(db_client, team_id)
            supervisor_id = team.get("supervisor_id")
            if supervisor_id:
                evaluate_alert_rules_for_call(
                    db_client,
                    team_id=team_id,
                    supervisor_id=supervisor_id,
                    call_id=call["id"],
                    started_at=call["started_at"],
                    sentiment_score=analysis_result.sentiment_score,
                    topics=analysis_result.topics,
                    keywords=analysis_result.keywords,
                )
        except Exception:  # noqa: BLE001 - alerting must not block call simulation
            logger.exception(
                "Alert evaluation failed for simulated call %s",
                call["id"],
            )

        logger.info(
            "Created simulated call %s for agent %s using sample transcript %s",
            call["id"],
            agent_id,
            sample_transcript.get("id"),
        )

        return SimulateCallResponse(
            call_id=call["id"],
            transcript=transcript,
            sentiment_score=analysis_result.sentiment_score,
            sentiment_label=analysis_result.sentiment_label,
            summary=analysis_result.summary,
            key_moves=analysis_result.key_moves,
            is_resolved=analysis_result.is_resolved,
            topics=analysis_result.topics,
            keywords=analysis_result.keywords,
        )

    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AnalysisServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to simulate call",
        ) from exc
