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
    create_call_mock = MagicMock(return_value={"id": "call-123"})
    create_analysis_mock = MagicMock(return_value={"id": "analysis-123"})
    add_topics_mock = MagicMock()
    add_keywords_mock = MagicMock()

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
