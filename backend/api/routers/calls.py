"""Call endpoints for agents and supervisors."""

import random
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.dependencies import get_current_user, get_supabase_client
from database.analysis import add_topics_to_analysis, create_analysis
from database.calls import create_call
from database.exceptions import DatabaseError

router = APIRouter()


# Sample data for generating realistic calls
TOPICS = [
    "billing-issue",
    "technical-support",
    "account-access",
    "product-inquiry",
    "cancellation-request",
    "upgrade-request",
    "complaint",
    "general-inquiry",
]

SUMMARIES = {
    "positive": [
        "Customer was satisfied with the resolution provided. Issue resolved successfully.",
        "Great conversation! Customer appreciated the quick response and helpful guidance.",
        "Customer expressed gratitude for the assistance. All questions answered thoroughly.",
        "Smooth call with excellent rapport. Customer left happy with the solution.",
    ],
    "neutral": [
        "Customer inquiry handled. Some information provided, follow-up may be needed.",
        "Standard support call. Customer received requested information.",
        "Call completed. Customer's questions were addressed adequately.",
        "Routine inquiry. Customer was informed about next steps.",
    ],
    "negative": [
        "Customer was frustrated with long wait times and unresolved issue.",
        "Difficult conversation. Customer unhappy with current service limitations.",
        "Customer expressed dissatisfaction. Issue requires escalation.",
        "Challenging call. Customer remained upset despite attempted resolution.",
    ],
}


# =============================================================================
# Response Models
# =============================================================================


class SimulateCallResponse(BaseModel):
    """Response for simulated call creation."""

    call_id: str
    sentiment_score: float
    sentiment_label: str
    summary: str
    topics: list[str]


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


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/simulate", response_model=SimulateCallResponse)
def simulate_call(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> SimulateCallResponse:
    """
    Simulate a call for the current agent.

    Creates a realistic call record with random sentiment, topics, and analysis.
    Used for testing and demo purposes.

    Requires authentication and team assignment.
    """
    db_client = _require_client(client)
    agent_id = current_user.get("id")
    team_id = _get_user_team_id(current_user)

    # Generate random call data within the last 6 days (to show in performance tab)
    call_time = datetime.now() - timedelta(
        days=random.randint(0, 6),  # Last 7 days only
        hours=random.randint(0, 8),
        minutes=random.randint(0, 59),
    )
    duration = random.randint(120, 1200)  # 2-20 minutes

    # Random sentiment (weighted towards neutral/positive)
    sentiment_type = random.choices(
        ["positive", "neutral", "negative"], weights=[0.4, 0.4, 0.2]
    )[0]

    if sentiment_type == "positive":
        sentiment_score = random.uniform(0.3, 1.0)
    elif sentiment_type == "neutral":
        sentiment_score = random.uniform(-0.29, 0.29)
    else:
        sentiment_score = random.uniform(-1.0, -0.3)

    try:
        # Create call record
        call = create_call(
            db_client,
            agent_id=agent_id,
            team_id=team_id,
            recording_url=f"https://example.com/recordings/call-{random.randint(10000, 99999)}.mp3",
            duration_seconds=duration,
            started_at=call_time.isoformat(),
        )

        # Create call analysis
        summary = random.choice(SUMMARIES[sentiment_type])
        is_resolved = sentiment_type != "negative" or random.random() > 0.5

        rounded_score = round(sentiment_score, 3)

        analysis = create_analysis(
            db_client,
            call_id=call["id"],
            summary=summary,
            sentiment_score=rounded_score,
            sentiment_label=sentiment_type,
            key_moves=[],  # Not used for simulated calls
            is_resolved=is_resolved,
        )

        # Add random topics
        num_topics = random.randint(1, 3)
        selected_topics = random.sample(TOPICS, num_topics)
        add_topics_to_analysis(db_client, analysis["id"], selected_topics)

        # Log for debugging
        print(f"Created call with sentiment: {rounded_score} ({sentiment_type})")

        return SimulateCallResponse(
            call_id=call["id"],
            sentiment_score=rounded_score,
            sentiment_label=sentiment_type,
            summary=summary,
            topics=selected_topics,
        )

    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to simulate call",
        ) from exc
