"""Agent-specific endpoints for performance and personal data.

This module provides endpoints for agents to view their own performance
metrics, trends, and team comparisons.
"""

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.dependencies import get_current_user, get_supabase_client
from database.constants import Tables
from database.exceptions import DatabaseError

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================


class WeeklyTrendItem(BaseModel):
    """Single day's performance metrics."""

    day: str  # Day name like "Mon", "Tue", etc.
    sentiment: float
    calls: int


class PerformanceResponse(BaseModel):
    """Agent performance metrics and trends."""

    total_calls: int
    avg_sentiment: float
    percentile: int
    weekly_trend: list[WeeklyTrendItem]


# =============================================================================
# Helper Functions
# =============================================================================


def _require_client(client: Any) -> Any:
    """Ensure the database client is available.

    Args:
        client: The Supabase client instance

    Returns:
        The validated client

    Raises:
        HTTPException: If client is None (503 Service Unavailable)
    """
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )
    return client


def _require_agent_role(current_user: dict) -> None:
    """Ensure the current user is an agent.

    Args:
        current_user: User dict containing role

    Raises:
        HTTPException: If user is not an agent (403 Forbidden)
    """
    role = current_user.get("role")
    if role != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible to agents",
        )


def _get_user_team_id(current_user: dict) -> str:
    """Extract team_id from current user.

    Args:
        current_user: User dict containing team_id

    Returns:
        The team ID string

    Raises:
        HTTPException: If user is not assigned to a team (403 Forbidden)
    """
    team_id = current_user.get("team_id")
    if not team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a team",
        )
    return team_id


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/performance", response_model=PerformanceResponse)
def get_agent_performance(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> PerformanceResponse:
    """Get personal performance metrics for the authenticated agent.

    Returns performance data for the last 7 days including:
    - Total call count
    - Average sentiment score
    - Percentile rank within the team
    - Daily breakdown of sentiment and call volume

    If the agent is not assigned to a team, returns empty metrics with zeros.

    The percentile is calculated by comparing the agent's average sentiment
    to all other agents in their team over the same period.

    Args:
        current_user: The authenticated agent user
        client: Supabase database client

    Returns:
        PerformanceResponse with metrics and weekly trends

    Raises:
        HTTPException: 403 if not an agent
        HTTPException: 503 if database is unavailable
    """
    db_client = _require_client(client)
    _require_agent_role(current_user)
    agent_id = current_user.get("id")
    team_id = current_user.get("team_id")

    # If agent is not on a team, return empty metrics
    if not team_id:
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        date_from = date.today() - timedelta(days=6)
        empty_trend = [
            WeeklyTrendItem(
                day=day_names[(date_from + timedelta(days=i)).weekday()],
                sentiment=0.0,
                calls=0,
            )
            for i in range(7)
        ]
        return PerformanceResponse(
            total_calls=0,
            avg_sentiment=0.0,
            percentile=50,
            weekly_trend=empty_trend,
        )

    # Calculate date range for last 7 days
    date_to = date.today()
    date_from = date_to - timedelta(days=6)

    try:
        # Query agent's calls from last 7 days with their analyses
        agent_calls_result = (
            db_client.table(Tables.CALLS)
            .select(f"*, {Tables.CALL_ANALYSES}(*)")
            .eq("agent_id", agent_id)
            .gte("started_at", date_from.isoformat())
            .lte("started_at", (date_to + timedelta(days=1)).isoformat())
            .execute()
        )

        agent_calls = agent_calls_result.data

        # Debug: Print first call structure
        if agent_calls:
            print(f"First call structure: {agent_calls[0]}")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent calls: {str(exc)}",
        ) from exc

    # Calculate total calls and average sentiment
    total_calls = len(agent_calls)
    sentiments = []
    for call in agent_calls:
        analyses = call.get(Tables.CALL_ANALYSES)
        # Handle both dict (single record) and list formats
        if analyses:
            # If it's a dict, treat it as a single analysis
            if isinstance(analyses, dict):
                sentiment_score = analyses.get("sentiment_score")
                if sentiment_score is not None:
                    sentiments.append(sentiment_score)
            # If it's a list, get the first item
            elif isinstance(analyses, list) and len(analyses) > 0:
                sentiment_score = analyses[0].get("sentiment_score")
                if sentiment_score is not None:
                    sentiments.append(sentiment_score)

    avg_sentiment = round(sum(sentiments) / len(sentiments), 2) if sentiments else 0.0

    # Log for debugging
    print(f"Agent {agent_id}: {total_calls} calls, {len(sentiments)} with sentiment, avg: {avg_sentiment}")

    # Calculate percentile within team
    # Query all agents in the team and their average sentiment
    try:
        team_calls_result = (
            db_client.table(Tables.CALLS)
            .select(f"agent_id, {Tables.CALL_ANALYSES}(*)")
            .eq("team_id", team_id)
            .gte("started_at", date_from.isoformat())
            .lte("started_at", (date_to + timedelta(days=1)).isoformat())
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch team calls: {str(exc)}",
        ) from exc

    # Group by agent and calculate average sentiment for each
    agent_sentiments: dict[str, list[float]] = {}
    for call in team_calls_result.data:
        call_agent_id = call["agent_id"]
        analyses = call.get(Tables.CALL_ANALYSES)
        # Handle both dict (single record) and list formats
        if analyses:
            sentiment_score = None
            if isinstance(analyses, dict):
                sentiment_score = analyses.get("sentiment_score")
            elif isinstance(analyses, list) and len(analyses) > 0:
                sentiment_score = analyses[0].get("sentiment_score")

            if sentiment_score is not None:
                if call_agent_id not in agent_sentiments:
                    agent_sentiments[call_agent_id] = []
                agent_sentiments[call_agent_id].append(sentiment_score)

    # Calculate average sentiment for each agent
    team_averages = [
        sum(scores) / len(scores) for scores in agent_sentiments.values() if scores
    ]

    # Calculate percentile (what % of team this agent outperforms)
    if team_averages and avg_sentiment > 0:
        agents_below = sum(1 for avg in team_averages if avg < avg_sentiment)
        percentile = round((agents_below / len(team_averages)) * 100)
    else:
        percentile = 50  # Default to 50th percentile if no data

    # Build weekly trend data
    weekly_trend: list[WeeklyTrendItem] = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for i in range(7):
        day_date = date_from + timedelta(days=i)
        day_name = day_names[day_date.weekday()]

        # Filter calls for this specific day
        day_calls = [
            call
            for call in agent_calls
            if call["started_at"].startswith(day_date.isoformat())
        ]

        # Calculate sentiment for the day
        day_sentiments = []
        for call in day_calls:
            analyses = call.get(Tables.CALL_ANALYSES)
            # Handle both dict (single record) and list formats
            if analyses:
                sentiment_score = None
                if isinstance(analyses, dict):
                    sentiment_score = analyses.get("sentiment_score")
                elif isinstance(analyses, list) and len(analyses) > 0:
                    sentiment_score = analyses[0].get("sentiment_score")

                if sentiment_score is not None:
                    day_sentiments.append(sentiment_score)

        day_avg_sentiment = (
            round(sum(day_sentiments) / len(day_sentiments), 2)
            if day_sentiments
            else 0.0
        )

        weekly_trend.append(
            WeeklyTrendItem(
                day=day_name,
                sentiment=day_avg_sentiment,
                calls=len(day_calls),
            )
        )

    return PerformanceResponse(
        total_calls=total_calls,
        avg_sentiment=avg_sentiment,
        percentile=percentile,
        weekly_trend=weekly_trend,
    )
