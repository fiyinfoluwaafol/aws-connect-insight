"""Dashboard endpoints for supervisor analytics."""

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.dependencies import get_current_user, get_supabase_client
from database.exceptions import DatabaseError
from database.metrics import get_agent_stats, get_daily_metrics, get_metrics_summary, get_top_topics

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================


class DailyMetric(BaseModel):
    """Single day's aggregated metrics."""

    date: str
    call_count: int
    avg_sentiment: float | None
    avg_duration: int | None
    negative_call_percent: float


class TopicCount(BaseModel):
    """Topic with occurrence count."""

    name: str
    count: int


class AgentStat(BaseModel):
    """Per-agent statistics."""

    agent_id: str
    name: str
    call_count: int
    avg_sentiment: float | None


class SentimentDistribution(BaseModel):
    """Count of calls by sentiment label."""

    positive: int
    neutral: int
    negative: int


class TrendsResponse(BaseModel):
    """Response for GET /api/dashboard/trends."""

    daily_metrics: list[DailyMetric]
    total_calls: int
    avg_sentiment: float | None
    avg_duration: int | None
    negative_call_percent: float
    sentiment_distribution: SentimentDistribution
    top_topics: list[TopicCount]
    agent_stats: list[AgentStat]


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


def _require_supervisor_role(current_user: dict) -> None:
    """Ensure the current user is a supervisor."""
    role = current_user.get("role")
    if role != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible to supervisors",
        )


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/trends", response_model=TrendsResponse)
def get_trends(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
    days: Annotated[int, Query(ge=1, le=90, description="Number of days to include")] = 14,
) -> TrendsResponse:
    """
    Get historical analytics trends for the supervisor dashboard.

    Returns daily metrics, sentiment distribution, top topics, and agent stats
    for the specified number of days.

    Requires authentication and supervisor role. Data is scoped to the user's team.
    """
    db_client = _require_client(client)
    _require_supervisor_role(current_user)
    team_id = _get_user_team_id(current_user)

    # Calculate date range
    date_to = date.today()
    date_from = date_to - timedelta(days=days - 1)

    try:
        # Fetch metrics (sequential calls - could be parallelized with async)
        daily = get_daily_metrics(db_client, date_from, date_to, team_id=team_id)
        summary = get_metrics_summary(db_client, date_from, date_to, team_id=team_id)
        topics = get_top_topics(db_client, date_from, date_to, team_id=team_id)
        agents = get_agent_stats(db_client, date_from, date_to, team_id=team_id)

    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard metrics",
        ) from exc

    return TrendsResponse(
        daily_metrics=[DailyMetric(**d) for d in daily],
        total_calls=summary["total_calls"],
        avg_sentiment=summary["avg_sentiment"],
        avg_duration=summary["avg_duration"],
        negative_call_percent=summary["negative_call_percent"],
        sentiment_distribution=SentimentDistribution(**summary["sentiment_distribution"]),
        top_topics=[TopicCount(**t) for t in topics],
        agent_stats=[AgentStat(**a) for a in agents],
    )
