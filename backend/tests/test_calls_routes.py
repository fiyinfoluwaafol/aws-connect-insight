"""API tests for call simulation routes."""

from unittest.mock import ANY, MagicMock

import pytest
from fastapi.testclient import TestClient

from api import dependencies
from api.main import app as _app
from api.routers import calls as calls_router
from database.exceptions import DatabaseError, NotFoundError
from services.transcript_analysis import AnalysisServiceError, TranscriptAnalysisResponse


@pytest.fixture
def agent_user():
    """Authenticated agent user for simulate route tests."""
    return {
        "id": "agent-123",
        "email": "agent@example.com",
        "team_id": "team-456",
        "role": "agent",
    }


@pytest.fixture
def supervisor_user():
    """Authenticated supervisor user for call detail route tests."""
    return {
        "id": "supervisor-123",
        "email": "supervisor@example.com",
        "team_id": "team-456",
        "role": "supervisor",
    }


@pytest.fixture
def authenticated_agent_client(mock_supabase: MagicMock, agent_user: dict):
    """Client with mocked authentication for agent routes."""

    def _override_get_supabase_client():
        yield mock_supabase

    def _override_get_current_user():
        return agent_user

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[dependencies.get_current_user] = _override_get_current_user

    with TestClient(_app) as client:
        client.cookies.set("access_token", "valid-token")
        yield client

    _app.dependency_overrides.clear()


@pytest.fixture
def authenticated_supervisor_client(mock_supabase: MagicMock, supervisor_user: dict):
    """Client with mocked authentication for supervisor routes."""

    def _override_get_supabase_client():
        yield mock_supabase

    def _override_get_current_user():
        return supervisor_user

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[dependencies.get_current_user] = _override_get_current_user

    with TestClient(_app) as client:
        client.cookies.set("access_token", "valid-token")
        yield client

    _app.dependency_overrides.clear()


@pytest.fixture
def simulate_settings_override(app):
    """Override settings for simulate route tests."""
    from api.config import Settings

    settings = Settings(_env_file=None, openai_api_key="test-openai-key")
    app.dependency_overrides[calls_router.get_settings] = lambda: settings
    yield settings
    app.dependency_overrides.pop(calls_router.get_settings, None)


def test_simulate_call_returns_enriched_payload(
    authenticated_agent_client: TestClient,
    simulate_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/calls/simulate should use seeded transcripts and return full analysis data."""
    sample_transcript = {
        "id": "sample-row-1",
        "transcript": [
            {"speaker": "Customer", "text": "I need help with a refund."},
            {"speaker": "Agent", "text": "I can help with that today."},
        ],
    }
    analysis_result = TranscriptAnalysisResponse(
        summary="Customer requested a refund. Agent provided next steps.",
        sentiment_score=-0.45,
        sentiment_label="negative",
        key_moves=["acknowledged concern", "shared next steps"],
        is_resolved=False,
        topics=["Refund"],
        keywords={"refund": True, "issue": True},
    )
    create_call_mock = MagicMock(
        return_value={"id": "call-123", "started_at": "2026-04-02T12:00:00"}
    )
    create_analysis_mock = MagicMock(return_value={"id": "analysis-123"})
    add_topics_mock = MagicMock()
    add_keywords_mock = MagicMock()
    get_team_mock = MagicMock(return_value={"id": "team-456", "supervisor_id": "sup-999"})
    evaluate_alerts_mock = MagicMock()

    monkeypatch.setattr(
        calls_router,
        "get_random_sample_transcript",
        MagicMock(return_value=sample_transcript),
    )
    monkeypatch.setattr(
        calls_router,
        "analyze_transcript_with_openai",
        MagicMock(return_value=analysis_result),
    )
    monkeypatch.setattr(calls_router, "create_call", create_call_mock)
    monkeypatch.setattr(calls_router, "create_analysis", create_analysis_mock)
    monkeypatch.setattr(calls_router, "add_topics_to_analysis", add_topics_mock)
    monkeypatch.setattr(calls_router, "add_keywords_to_analysis", add_keywords_mock)
    monkeypatch.setattr(calls_router, "get_team_by_id", get_team_mock)
    monkeypatch.setattr(calls_router, "evaluate_alert_rules_for_call", evaluate_alerts_mock)
    monkeypatch.setattr(
        calls_router.random,
        "randint",
        MagicMock(side_effect=[2, 3, 15, 180, 99999]),
    )

    response = authenticated_agent_client.post("/api/calls/simulate")

    assert response.status_code == 200
    assert response.json() == {
        "call_id": "call-123",
        "transcript": sample_transcript["transcript"],
        "summary": "Customer requested a refund. Agent provided next steps.",
        "sentiment_score": -0.45,
        "sentiment_label": "negative",
        "key_moves": ["acknowledged concern", "shared next steps"],
        "is_resolved": False,
        "topics": ["Refund"],
        "keywords": {"refund": True, "issue": True},
    }

    calls_router.get_random_sample_transcript.assert_called_once()
    calls_router.analyze_transcript_with_openai.assert_called_once_with(
        sample_transcript["transcript"],
        model="gpt-5-mini",
        api_key="test-openai-key",
    )
    create_call_mock.assert_called_once_with(
        ANY,
        agent_id="agent-123",
        team_id="team-456",
        recording_url="https://example.com/recordings/call-99999.mp3",
        duration_seconds=180,
        started_at=ANY,
        transcript=sample_transcript["transcript"],
    )
    create_analysis_mock.assert_called_once_with(
        ANY,
        call_id="call-123",
        summary="Customer requested a refund. Agent provided next steps.",
        sentiment_score=-0.45,
        sentiment_label="negative",
        key_moves=["acknowledged concern", "shared next steps"],
        is_resolved=False,
    )
    add_topics_mock.assert_called_once_with(ANY, "analysis-123", ["Refund"])
    add_keywords_mock.assert_called_once_with(ANY, "analysis-123", ["refund", "issue"])
    get_team_mock.assert_called_once_with(ANY, "team-456")
    evaluate_alerts_mock.assert_called_once()
    assert evaluate_alerts_mock.call_args.kwargs["team_id"] == "team-456"
    assert evaluate_alerts_mock.call_args.kwargs["supervisor_id"] == "sup-999"
    assert evaluate_alerts_mock.call_args.kwargs["call_id"] == "call-123"


def test_simulate_call_returns_503_when_no_sample_transcript(
    authenticated_agent_client: TestClient,
    simulate_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/calls/simulate should fail when no seeded transcript exists."""
    monkeypatch.setattr(
        calls_router,
        "get_random_sample_transcript",
        MagicMock(side_effect=NotFoundError("No sample transcripts found")),
    )

    response = authenticated_agent_client.post("/api/calls/simulate")

    assert response.status_code == 503
    assert response.json() == {"detail": "No sample transcripts found"}


def test_simulate_call_returns_502_when_analysis_fails(
    authenticated_agent_client: TestClient,
    simulate_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/calls/simulate should fail without creating a call when analysis fails."""
    monkeypatch.setattr(
        calls_router,
        "get_random_sample_transcript",
        MagicMock(
            return_value={
                "id": "sample-1",
                "transcript": [{"speaker": "Customer", "text": "Hello"}],
            }
        ),
    )
    monkeypatch.setattr(
        calls_router,
        "analyze_transcript_with_openai",
        MagicMock(side_effect=AnalysisServiceError("Failed to analyze transcript with OpenAI")),
    )
    create_call_mock = MagicMock()
    monkeypatch.setattr(calls_router, "create_call", create_call_mock)
    monkeypatch.setattr(calls_router.random, "randint", MagicMock(side_effect=[1, 2, 3, 180]))

    response = authenticated_agent_client.post("/api/calls/simulate")

    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to analyze transcript with OpenAI"}
    create_call_mock.assert_not_called()


def test_simulate_call_returns_503_when_openai_not_configured(
    authenticated_agent_client: TestClient,
    app,
) -> None:
    """POST /api/calls/simulate should return 503 when the OpenAI key is missing."""
    from api.config import Settings

    app.dependency_overrides[calls_router.get_settings] = lambda: Settings(
        _env_file=None, openai_api_key=""
    )

    response = authenticated_agent_client.post("/api/calls/simulate")

    assert response.status_code == 503
    assert response.json() == {"detail": "Analysis service unavailable"}
    app.dependency_overrides.pop(calls_router.get_settings, None)


def test_simulate_call_returns_500_on_database_failure(
    authenticated_agent_client: TestClient,
    simulate_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/calls/simulate should return 500 when database writes fail."""
    monkeypatch.setattr(
        calls_router,
        "get_random_sample_transcript",
        MagicMock(
            return_value={
                "id": "sample-1",
                "transcript": [{"speaker": "Customer", "text": "Hello"}],
            }
        ),
    )
    monkeypatch.setattr(
        calls_router,
        "analyze_transcript_with_openai",
        MagicMock(
            return_value=TranscriptAnalysisResponse(
                summary="Call reviewed.",
                sentiment_score=0.0,
                sentiment_label="neutral",
                key_moves=[],
                is_resolved=False,
                topics=[],
                keywords={},
            )
        ),
    )
    monkeypatch.setattr(
        calls_router,
        "create_call",
        MagicMock(side_effect=DatabaseError("create_call failed: boom")),
    )
    monkeypatch.setattr(
        calls_router.random,
        "randint",
        MagicMock(side_effect=[1, 2, 3, 180, 12345]),
    )

    response = authenticated_agent_client.post("/api/calls/simulate")

    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to simulate call"}


def test_simulate_call_returns_success_when_alert_evaluation_fails(
    authenticated_agent_client: TestClient,
    simulate_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/calls/simulate should still succeed if alert generation fails."""
    sample_transcript = {
        "id": "sample-row-1",
        "transcript": [
            {"speaker": "Customer", "text": "I need help with a refund."},
            {"speaker": "Agent", "text": "I can help with that today."},
        ],
    }
    analysis_result = TranscriptAnalysisResponse(
        summary="Customer requested a refund. Agent provided next steps.",
        sentiment_score=-0.45,
        sentiment_label="negative",
        key_moves=["acknowledged concern", "shared next steps"],
        is_resolved=False,
        topics=["Refund"],
        keywords={"refund": True},
    )

    monkeypatch.setattr(
        calls_router,
        "get_random_sample_transcript",
        MagicMock(return_value=sample_transcript),
    )
    monkeypatch.setattr(
        calls_router,
        "analyze_transcript_with_openai",
        MagicMock(return_value=analysis_result),
    )
    monkeypatch.setattr(
        calls_router,
        "create_call",
        MagicMock(return_value={"id": "call-123", "started_at": "2026-04-02T12:00:00"}),
    )
    monkeypatch.setattr(
        calls_router,
        "create_analysis",
        MagicMock(return_value={"id": "analysis-123"}),
    )
    monkeypatch.setattr(calls_router, "add_topics_to_analysis", MagicMock())
    monkeypatch.setattr(calls_router, "add_keywords_to_analysis", MagicMock())
    monkeypatch.setattr(
        calls_router,
        "get_team_by_id",
        MagicMock(return_value={"id": "team-456", "supervisor_id": "sup-999"}),
    )
    monkeypatch.setattr(
        calls_router,
        "evaluate_alert_rules_for_call",
        MagicMock(side_effect=RuntimeError("alerting boom")),
    )
    monkeypatch.setattr(
        calls_router.random,
        "randint",
        MagicMock(side_effect=[2, 3, 15, 180, 99999]),
    )

    response = authenticated_agent_client.post("/api/calls/simulate")

    assert response.status_code == 200
    assert response.json()["call_id"] == "call-123"


def test_get_call_detail_returns_call_for_same_team(
    authenticated_supervisor_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /api/calls/{call_id} should return alert-ready call detail for same-team users."""
    monkeypatch.setattr(
        calls_router,
        "fetch_call_by_id",
        MagicMock(
            return_value={
                "id": "call-123",
                "agent_id": "agent-123",
                "team_id": "team-456",
                "started_at": "2026-04-02T12:00:00Z",
                "duration_seconds": 305,
                "transcript": [
                    {"speaker": "Customer", "text": "I need help with a refund."},
                    {"speaker": "Agent", "text": "I can help with that."},
                ],
            }
        ),
    )
    monkeypatch.setattr(
        calls_router,
        "get_user_by_id",
        MagicMock(
            return_value={
                "id": "agent-123",
                "first_name": "Ada",
                "last_name": "Lovelace",
                "email": "ada@example.com",
            }
        ),
    )
    monkeypatch.setattr(
        calls_router,
        "get_analysis_by_call_id",
        MagicMock(
            return_value={
                "summary": "Customer requested a refund.",
                "sentiment_score": -0.4,
                "sentiment_label": "negative",
                "is_resolved": False,
                "topics": ["refund"],
            }
        ),
    )

    response = authenticated_supervisor_client.get("/api/calls/call-123")

    assert response.status_code == 200
    assert response.json() == {
        "id": "call-123",
        "agent_id": "agent-123",
        "agent_name": "Ada Lovelace",
        "started_at": "2026-04-02T12:00:00Z",
        "duration_seconds": 305,
        "sentiment_score": -0.4,
        "sentiment_label": "negative",
        "is_resolved": False,
        "topics": ["refund"],
        "summary": "Customer requested a refund.",
        "transcript": [
            {"speaker": "Customer", "text": "I need help with a refund.", "timestamp": None},
            {"speaker": "Agent", "text": "I can help with that.", "timestamp": None},
        ],
    }


def test_get_call_detail_returns_404_for_other_team(
    authenticated_supervisor_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /api/calls/{call_id} should not expose calls from another team."""
    monkeypatch.setattr(
        calls_router,
        "fetch_call_by_id",
        MagicMock(
            return_value={
                "id": "call-123",
                "agent_id": "agent-123",
                "team_id": "other-team",
                "transcript": [],
            }
        ),
    )

    response = authenticated_supervisor_client.get("/api/calls/call-123")

    assert response.status_code == 404
    assert response.json() == {"detail": "Call call-123 not found"}
