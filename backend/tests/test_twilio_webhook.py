"""API tests for Twilio recording webhook."""

from unittest.mock import ANY, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api import dependencies
from api.config import Settings
from api.main import app as _app
from api.routers import twilio as twilio_router
from services.transcript_analysis import TranscriptAnalysisResponse

TWILIO_SETTINGS = Settings(
    _env_file=None,
    openai_api_key="test-openai-key",
    twilio_account_sid="ACtest123",
    twilio_auth_token="test-auth-token",
    twilio_demo_agent_email="agent@example.com",
    supabase_url="https://fake.supabase.co",
    supabase_service_role_key="fake-service-role-key",
)

VALID_FORM_DATA = {
    "AccountSid": "ACtest123",
    "CallSid": "CA123",
    "RecordingSid": "RE456",
    "RecordingUrl": "https://api.twilio.com/recordings/RE456",
    "RecordingStatus": "completed",
    "RecordingDuration": "120",
}


@pytest.fixture
def twilio_client(mock_supabase: MagicMock):
    """Client configured for Twilio webhook tests (no cookie auth needed)."""

    def _override_get_supabase_client():
        yield mock_supabase

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[twilio_router.get_settings] = lambda: TWILIO_SETTINGS

    with TestClient(_app) as client:
        yield client

    _app.dependency_overrides.clear()


@pytest.fixture
def twilio_client_unconfigured(mock_supabase: MagicMock):
    """Client with Twilio credentials missing."""
    empty_settings = Settings(
        _env_file=None,
        openai_api_key="test-key",
        twilio_account_sid="",
        twilio_auth_token="",
        twilio_demo_agent_email="",
    )

    def _override_get_supabase_client():
        yield mock_supabase

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client
    _app.dependency_overrides[twilio_router.get_settings] = lambda: empty_settings

    with TestClient(_app) as client:
        yield client

    _app.dependency_overrides.clear()


def test_recording_status_returns_503_when_twilio_not_configured(
    twilio_client_unconfigured: TestClient,
) -> None:
    """POST /api/twilio/recording-status should return 503 when Twilio is not configured."""
    response = twilio_client_unconfigured.post(
        "/api/twilio/recording-status",
        data=VALID_FORM_DATA,
    )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_recording_status_rejects_invalid_signature(
    twilio_client: TestClient,
) -> None:
    """POST /api/twilio/recording-status should return 403 for invalid signatures."""
    with patch.object(twilio_router, "_validate_twilio_signature", return_value=False):
        response = twilio_client.post(
            "/api/twilio/recording-status",
            data=VALID_FORM_DATA,
        )
    assert response.status_code == 403
    assert "signature" in response.json()["detail"].lower()


def test_recording_status_ignores_non_completed_status(
    twilio_client: TestClient,
) -> None:
    """POST /api/twilio/recording-status should return 200 and ignore non-completed statuses."""
    form_data = {**VALID_FORM_DATA, "RecordingStatus": "in-progress"}

    with patch.object(twilio_router, "_validate_twilio_signature", return_value=True):
        response = twilio_client.post(
            "/api/twilio/recording-status",
            data=form_data,
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_recording_status_ignores_missing_recording_url(
    twilio_client: TestClient,
) -> None:
    """POST /api/twilio/recording-status should ignore callbacks with no RecordingUrl."""
    form_data = {**VALID_FORM_DATA, "RecordingUrl": ""}

    with patch.object(twilio_router, "_validate_twilio_signature", return_value=True):
        response = twilio_client.post(
            "/api/twilio/recording-status",
            data=form_data,
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_recording_status_queues_background_processing(
    twilio_client: TestClient,
) -> None:
    """POST /api/twilio/recording-status should accept valid callbacks and queue processing."""
    with (
        patch.object(twilio_router, "_validate_twilio_signature", return_value=True),
        patch.object(twilio_router, "_process_recording") as mock_process,
    ):
        response = twilio_client.post(
            "/api/twilio/recording-status",
            data=VALID_FORM_DATA,
        )

    assert response.status_code == 200
    assert response.json()["status"] == "processing"

    mock_process.assert_called_once_with(
        recording_url="https://api.twilio.com/recordings/RE456",
        recording_duration=120,
        call_sid="CA123",
        settings=TWILIO_SETTINGS,
    )


def test_process_recording_full_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    """_process_recording should transcribe, create call, analyse, and evaluate alerts."""
    mock_transcript = [
        {"speaker": "Customer", "text": "I have a billing question."},
        {"speaker": "Agent", "text": "I can help with that."},
    ]
    analysis_result = TranscriptAnalysisResponse(
        summary="Customer asked about billing. Agent assisted.",
        sentiment_score=0.3,
        sentiment_label="positive",
        key_moves=["active listening"],
        is_resolved=True,
        topics=["Billing"],
        keywords={"satisfied": True},
    )
    mock_db_client = MagicMock()

    monkeypatch.setattr(
        twilio_router,
        "transcribe_recording",
        MagicMock(return_value=mock_transcript),
    )
    monkeypatch.setattr(
        twilio_router,
        "_resolve_demo_agent",
        MagicMock(return_value=("demo-agent-id", "demo-team-id")),
    )
    monkeypatch.setattr(
        twilio_router,
        "analyze_transcript_with_openai",
        MagicMock(return_value=analysis_result),
    )
    monkeypatch.setattr(
        twilio_router,
        "create_call",
        MagicMock(return_value={"id": "call-789", "started_at": "2026-04-10T12:00:00"}),
    )
    monkeypatch.setattr(
        twilio_router,
        "create_analysis",
        MagicMock(return_value={"id": "analysis-789"}),
    )
    monkeypatch.setattr(twilio_router, "add_topics_to_analysis", MagicMock())
    monkeypatch.setattr(twilio_router, "add_keywords_to_analysis", MagicMock())
    monkeypatch.setattr(
        twilio_router,
        "get_team_by_id",
        MagicMock(return_value={"id": "demo-team-id", "supervisor_id": "sup-111"}),
    )
    monkeypatch.setattr(twilio_router, "evaluate_alert_rules_for_call", MagicMock())
    monkeypatch.setattr(
        twilio_router,
        "_get_supabase_client_direct",
        MagicMock(return_value=mock_db_client),
    )

    twilio_router._process_recording(
        recording_url="https://api.twilio.com/recordings/RE456",
        recording_duration=120,
        call_sid="CA123",
        settings=TWILIO_SETTINGS,
    )

    twilio_router.transcribe_recording.assert_called_once_with(
        recording_url="https://api.twilio.com/recordings/RE456",
        account_sid="ACtest123",
        auth_token="test-auth-token",
        openai_api_key="test-openai-key",
    )
    twilio_router._resolve_demo_agent.assert_called_once_with(mock_db_client, "agent@example.com")
    twilio_router.create_call.assert_called_once_with(
        mock_db_client,
        agent_id="demo-agent-id",
        team_id="demo-team-id",
        recording_url="https://api.twilio.com/recordings/RE456",
        duration_seconds=120,
        started_at=ANY,
        transcript=mock_transcript,
    )
    twilio_router.create_analysis.assert_called_once()
    twilio_router.add_topics_to_analysis.assert_called_once_with(
        mock_db_client, "analysis-789", ["Billing"]
    )
    twilio_router.add_keywords_to_analysis.assert_called_once_with(
        mock_db_client, "analysis-789", ["satisfied"]
    )
    twilio_router.evaluate_alert_rules_for_call.assert_called_once()
