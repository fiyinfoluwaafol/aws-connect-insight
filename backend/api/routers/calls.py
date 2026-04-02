"""Call endpoints for agents and supervisors."""

import logging
import random
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.config import Settings, get_settings
from api.dependencies import get_current_user, get_supabase_client
from database.analysis import add_keywords_to_analysis, add_topics_to_analysis, create_analysis
from database.calls import create_call
from database.exceptions import DatabaseError, NotFoundError
from database.sample_transcripts import get_random_sample_transcript
from database.teams import get_team_by_id
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


def _normalize_transcript(turns: Any) -> list[dict[str, str]]:
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


# =============================================================================
# Endpoints
# =============================================================================


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

    # Generate random call data within the last 6 days (to show in performance tab)
    call_time = datetime.now() - timedelta(
        days=random.randint(0, 6),  # Last 7 days only
        hours=random.randint(0, 8),
        minutes=random.randint(0, 59),
    )
    duration = random.randint(120, 1200)  # 2-20 minutes

    try:
        sample_transcript = get_random_sample_transcript(db_client)
        transcript = _normalize_transcript(sample_transcript.get("transcript"))
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
        except Exception as exc:  # noqa: BLE001 - alerting must not block call simulation
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
