"""API tests for transcript analysis routes."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api.routers import analysis as analysis_router
from services.transcript_analysis import TranscriptAnalysisResponse

LONG_SUMMARY = (
    "The customer reached out to the agent regarding an issue with their account, "
    "and the agent expressed willingness to assist. The conversation is just "
    "beginning, indicating a potential for resolution."
)


@pytest.fixture
def analysis_settings_override(app):
    """Override settings for analysis route tests."""
    from api.config import Settings

    settings = Settings(_env_file=None, openai_api_key="test-openai-key")
    app.dependency_overrides[analysis_router.get_settings] = lambda: settings
    yield settings
    app.dependency_overrides.pop(analysis_router.get_settings, None)


def test_analyze_transcript_returns_exact_contract(
    client: TestClient,
    analysis_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/analysis returns the exact response shape."""
    analyze_mock = MagicMock(
        return_value=TranscriptAnalysisResponse(
            summary=LONG_SUMMARY,
            sentiment_score=0.5,
            sentiment_label="positive",
            top_keywords=["active listening", "positive reinforcement"],
            is_resolved=False,
            topics=["Account setup"],
            keywords={},
        )
    )
    monkeypatch.setattr(analysis_router, "analyze_transcript_with_openai", analyze_mock)

    response = client.post(
        "/api/analysis",
        json={
            "transcript": [
                {"speaker": "Customer", "text": "I need help with my account"},
                {"speaker": "Agent", "text": "I can help with that"},
            ],
            "model": "gpt-4o-mini",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "summary": LONG_SUMMARY,
        "sentiment_score": 0.5,
        "sentiment_label": "positive",
        "top_keywords": ["active listening", "positive reinforcement"],
        "is_resolved": False,
        "topics": ["Account setup"],
        "keywords": {},
    }
    analyze_mock.assert_called_once_with(
        [
            {"speaker": "Customer", "text": "I need help with my account"},
            {"speaker": "Agent", "text": "I can help with that"},
        ],
        model="gpt-4o-mini",
        api_key="test-openai-key",
    )


def test_analyze_transcript_defaults_to_gpt_5_mini(
    client: TestClient,
    analysis_settings_override,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /api/analysis uses gpt-5-mini when no model is provided."""
    analyze_mock = MagicMock(
        return_value=TranscriptAnalysisResponse(
            summary="Call reviewed.",
            sentiment_score=0.2,
            sentiment_label="neutral",
            top_keywords=[],
            is_resolved=False,
            topics=[],
            keywords={},
        )
    )
    monkeypatch.setattr(analysis_router, "analyze_transcript_with_openai", analyze_mock)

    response = client.post(
        "/api/analysis",
        json={
            "transcript": "Customer: I need help\nAgent: I can help",
        },
    )

    assert response.status_code == 200
    analyze_mock.assert_called_once_with(
        "Customer: I need help\nAgent: I can help",
        model="gpt-5-mini",
        api_key="test-openai-key",
    )


def test_analyze_transcript_requires_openai_key(
    client: TestClient,
    app,
) -> None:
    """POST /api/analysis returns 503 when OpenAI is not configured."""
    from api.config import Settings

    app.dependency_overrides[analysis_router.get_settings] = lambda: Settings(
        _env_file=None, openai_api_key=""
    )

    response = client.post(
        "/api/analysis",
        json={
            "transcript": "Customer: Hello\nAgent: Hi",
            "model": "gpt-4o-mini",
        },
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Analysis service unavailable"}
    app.dependency_overrides.pop(analysis_router.get_settings, None)


def test_transcript_analysis_response_normalizes_notebook_shape() -> None:
    """Notebook-like output is normalized into the endpoint contract."""
    response = TranscriptAnalysisResponse.model_validate(
        {
            "summary": "Call reviewed.",
            "sentiment_score": "0.75",
            "sentiment_label": "POSITIVE",
            "key_moves": ["active listening", "positive reinforcement"],
            "is_resolved": False,
            "topics": ["account setup"],
            "keywords": ["refund", "charge"],
        }
    )

    assert response.model_dump() == {
        "summary": "Call reviewed.",
        "sentiment_score": 0.75,
        "sentiment_label": "positive",
        "top_keywords": ["active listening", "positive reinforcement"],
        "is_resolved": False,
        "topics": ["Account setup"],
        "keywords": {"refund": True, "charge": True},
    }


def test_transcript_analysis_keyword_normalization_drops_unknown_keys() -> None:
    """Only preferred keywords should survive normalization."""
    response = TranscriptAnalysisResponse.model_validate(
        {
            "summary": "Call reviewed.",
            "sentiment_score": 0.0,
            "sentiment_label": "neutral",
            "top_keywords": [],
            "is_resolved": False,
            "topics": [],
            "keywords": {"refund": True, "account": True, "delay": False},
        }
    )

    assert response.model_dump()["keywords"] == {"refund": True}


def test_transcript_analysis_response_drops_resolved_keyword_when_unresolved() -> None:
    """The resolved keyword should not appear when the call is unresolved."""
    response = TranscriptAnalysisResponse.model_validate(
        {
            "summary": "Call reviewed.",
            "sentiment_score": -0.4,
            "sentiment_label": "negative",
            "top_keywords": [],
            "is_resolved": False,
            "topics": [],
            "keywords": {"resolved": True, "refund": True},
        }
    )

    assert response.model_dump()["keywords"] == {"refund": True}
