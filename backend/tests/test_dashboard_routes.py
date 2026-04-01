"""Unit tests for dashboard API endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app as _app
from api import dependencies


@pytest.fixture
def mock_user_with_team():
    """Return a supervisor user dict with team assignment."""
    return {
        "id": "user-123",
        "email": "supervisor@example.com",
        "team_id": "team-456",
        "role": "supervisor",
    }


@pytest.fixture
def mock_user_without_team():
    """Return a user dict without team assignment."""
    return {
        "id": "user-123",
        "email": "orphan@example.com",
        "team_id": None,
        "role": "supervisor",
    }


@pytest.fixture
def mock_agent_user():
    """Return an agent user dict (non-supervisor)."""
    return {
        "id": "user-789",
        "email": "agent@example.com",
        "team_id": "team-456",
        "role": "agent",
    }


@pytest.fixture
def authenticated_client(mock_supabase: MagicMock, mock_user_with_team: dict):
    """Client with mocked authentication and team assignment."""

    def _override_get_supabase_client():
        yield mock_supabase

    def _override_get_current_user():
        return mock_user_with_team

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[dependencies.get_current_user] = _override_get_current_user

    with TestClient(_app) as client:
        client.cookies.set("access_token", "valid-token")
        yield client

    _app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client(mock_supabase: MagicMock):
    """Client without authentication."""

    def _override_get_supabase_client():
        yield mock_supabase

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    # Don't override get_current_user - let it check for missing token

    with TestClient(_app) as client:
        yield client

    _app.dependency_overrides.clear()


@pytest.fixture
def client_without_team(mock_supabase: MagicMock, mock_user_without_team: dict):
    """Client with authenticated user but no team assignment."""

    def _override_get_supabase_client():
        yield mock_supabase

    def _override_get_current_user():
        return mock_user_without_team

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[dependencies.get_current_user] = _override_get_current_user

    with TestClient(_app) as client:
        client.cookies.set("access_token", "valid-token")
        yield client

    _app.dependency_overrides.clear()


@pytest.fixture
def client_as_agent(mock_supabase: MagicMock, mock_agent_user: dict):
    """Client with authenticated agent user (non-supervisor)."""

    def _override_get_supabase_client():
        yield mock_supabase

    def _override_get_current_user():
        return mock_agent_user

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[dependencies.get_current_user] = _override_get_current_user

    with TestClient(_app) as client:
        client.cookies.set("access_token", "valid-token")
        yield client

    _app.dependency_overrides.clear()


# =============================================================================
# GET /api/dashboard/trends tests
# =============================================================================


def test_trends_returns_aggregated_metrics(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should return aggregated metrics."""
    with patch("api.routers.dashboard.get_daily_metrics") as mock_daily, \
         patch("api.routers.dashboard.get_metrics_summary") as mock_summary, \
         patch("api.routers.dashboard.get_top_topics") as mock_topics, \
         patch("api.routers.dashboard.get_agent_stats") as mock_agents:

        mock_daily.return_value = [
            {"date": "2026-03-01", "call_count": 10, "avg_sentiment": 0.5, "avg_duration": 300, "negative_call_percent": 20.0},
        ]
        mock_summary.return_value = {
            "total_calls": 100,
            "avg_sentiment": 0.45,
            "avg_duration": 280,
            "negative_call_percent": 22.5,
            "sentiment_distribution": {"positive": 50, "neutral": 30, "negative": 20},
        }
        mock_topics.return_value = [
            {"name": "billing", "count": 25},
            {"name": "refund", "count": 15},
        ]
        mock_agents.return_value = [
            {"agent_id": "agent-1", "name": "Jane Doe", "call_count": 30, "avg_sentiment": 0.6},
        ]

        response = authenticated_client.get("/api/dashboard/trends")

        assert response.status_code == 200
        data = response.json()

        assert data["total_calls"] == 100
        assert data["avg_sentiment"] == 0.45
        assert data["avg_duration"] == 280
        assert data["negative_call_percent"] == 22.5
        assert len(data["daily_metrics"]) == 1
        assert len(data["top_topics"]) == 2
        assert len(data["agent_stats"]) == 1
        assert data["sentiment_distribution"]["positive"] == 50


def test_trends_uses_days_parameter(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should respect the days query parameter."""
    with patch("api.routers.dashboard.get_daily_metrics") as mock_daily, \
         patch("api.routers.dashboard.get_metrics_summary") as mock_summary, \
         patch("api.routers.dashboard.get_top_topics") as mock_topics, \
         patch("api.routers.dashboard.get_agent_stats") as mock_agents:

        mock_daily.return_value = []
        mock_summary.return_value = {
            "total_calls": 0,
            "avg_sentiment": None,
            "avg_duration": None,
            "negative_call_percent": 0.0,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
        }
        mock_topics.return_value = []
        mock_agents.return_value = []

        response = authenticated_client.get("/api/dashboard/trends?days=30")

        assert response.status_code == 200

        # Verify the date range passed to the metrics functions
        call_args = mock_daily.call_args
        date_from = call_args[0][1]  # Second positional arg
        date_to = call_args[0][2]    # Third positional arg

        # Should span 30 days
        delta = (date_to - date_from).days
        assert delta == 29  # days-1 because date_from is inclusive


def test_trends_validates_days_parameter_minimum(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should reject days < 1."""
    response = authenticated_client.get("/api/dashboard/trends?days=0")
    assert response.status_code == 422


def test_trends_validates_days_parameter_maximum(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should reject days > 90."""
    response = authenticated_client.get("/api/dashboard/trends?days=100")
    assert response.status_code == 422


def test_trends_requires_authentication(unauthenticated_client: TestClient) -> None:
    """GET /api/dashboard/trends should require authentication."""
    response = unauthenticated_client.get("/api/dashboard/trends")

    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


def test_trends_requires_team_assignment(client_without_team: TestClient) -> None:
    """GET /api/dashboard/trends should require user to have a team."""
    response = client_without_team.get("/api/dashboard/trends")

    assert response.status_code == 403
    assert "not assigned to a team" in response.json()["detail"]


def test_trends_requires_supervisor_role(client_as_agent: TestClient) -> None:
    """GET /api/dashboard/trends should deny access to non-supervisors."""
    response = client_as_agent.get("/api/dashboard/trends")

    assert response.status_code == 403
    assert "only accessible to supervisors" in response.json()["detail"]


def test_trends_scopes_data_to_team(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should scope data to user's team."""
    with patch("api.routers.dashboard.get_daily_metrics") as mock_daily, \
         patch("api.routers.dashboard.get_metrics_summary") as mock_summary, \
         patch("api.routers.dashboard.get_top_topics") as mock_topics, \
         patch("api.routers.dashboard.get_agent_stats") as mock_agents:

        mock_daily.return_value = []
        mock_summary.return_value = {
            "total_calls": 0,
            "avg_sentiment": None,
            "avg_duration": None,
            "negative_call_percent": 0.0,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
        }
        mock_topics.return_value = []
        mock_agents.return_value = []

        authenticated_client.get("/api/dashboard/trends")

        # Verify team_id was passed to all metrics functions
        assert mock_daily.call_args.kwargs.get("team_id") == "team-456"
        assert mock_summary.call_args.kwargs.get("team_id") == "team-456"
        assert mock_topics.call_args.kwargs.get("team_id") == "team-456"
        assert mock_agents.call_args.kwargs.get("team_id") == "team-456"


def test_trends_handles_empty_data(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should handle empty data gracefully."""
    with patch("api.routers.dashboard.get_daily_metrics") as mock_daily, \
         patch("api.routers.dashboard.get_metrics_summary") as mock_summary, \
         patch("api.routers.dashboard.get_top_topics") as mock_topics, \
         patch("api.routers.dashboard.get_agent_stats") as mock_agents:

        mock_daily.return_value = []
        mock_summary.return_value = {
            "total_calls": 0,
            "avg_sentiment": None,
            "avg_duration": None,
            "negative_call_percent": 0.0,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
        }
        mock_topics.return_value = []
        mock_agents.return_value = []

        response = authenticated_client.get("/api/dashboard/trends")

        assert response.status_code == 200
        data = response.json()

        assert data["total_calls"] == 0
        assert data["avg_sentiment"] is None
        assert data["avg_duration"] is None
        assert data["daily_metrics"] == []
        assert data["top_topics"] == []
        assert data["agent_stats"] == []


def test_trends_returns_500_on_database_error(
    authenticated_client: TestClient,
) -> None:
    """GET /api/dashboard/trends should return 500 when database fails."""
    from database.exceptions import DatabaseError

    with patch("api.routers.dashboard.get_daily_metrics") as mock_daily:
        mock_daily.side_effect = DatabaseError("Connection failed")

        response = authenticated_client.get("/api/dashboard/trends")

        assert response.status_code == 500
        assert "Failed to fetch dashboard metrics" in response.json()["detail"]


def test_trends_returns_503_when_client_unavailable(
    mock_supabase: MagicMock,
    mock_user_with_team: dict,
) -> None:
    """GET /api/dashboard/trends should return 503 when database client is None."""

    def _override_get_supabase_client():
        yield None  # Simulate unavailable database

    def _override_get_current_user():
        return mock_user_with_team

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[dependencies.get_current_user] = _override_get_current_user

    with TestClient(_app) as client:
        client.cookies.set("access_token", "valid-token")
        response = client.get("/api/dashboard/trends")

    _app.dependency_overrides.clear()

    assert response.status_code == 503
    assert "Database service unavailable" in response.json()["detail"]
