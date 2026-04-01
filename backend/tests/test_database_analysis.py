"""Unit tests for call analysis database helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from database import analysis as analysis_helpers
from database.constants import Tables
from database.exceptions import DatabaseError


# =============================================================================
# upsert_analysis tests
# =============================================================================


def test_upsert_analysis_creates_new_record() -> None:
    """upsert_analysis should insert a new analysis when none exists."""
    client = MagicMock()

    mock_result = SimpleNamespace(data=[{
        "id": "analysis-123",
        "call_id": "call-456",
        "summary": "Customer asked about billing",
        "sentiment_score": 0.5,
        "sentiment_label": "positive",
        "key_moves": ["Acknowledged concern", "Provided clear answer"],
        "is_resolved": True,
    }])

    client.table.return_value.upsert.return_value.execute.return_value = mock_result

    result = analysis_helpers.upsert_analysis(
        client,
        call_id="call-456",
        summary="Customer asked about billing",
        sentiment_score=0.5,
        sentiment_label="positive",
        key_moves=["Acknowledged concern", "Provided clear answer"],
        is_resolved=True,
    )

    # Verify the upsert was called with correct params
    client.table.assert_called_with(Tables.CALL_ANALYSES)
    client.table.return_value.upsert.assert_called_once_with(
        {
            "call_id": "call-456",
            "summary": "Customer asked about billing",
            "sentiment_score": 0.5,
            "sentiment_label": "positive",
            "key_moves": ["Acknowledged concern", "Provided clear answer"],
            "is_resolved": True,
        },
        on_conflict="call_id",
    )

    assert result["id"] == "analysis-123"
    assert result["call_id"] == "call-456"


def test_upsert_analysis_updates_existing_record() -> None:
    """upsert_analysis should update when analysis already exists for call_id."""
    client = MagicMock()

    # Simulate an update (same call_id, different data)
    mock_result = SimpleNamespace(data=[{
        "id": "analysis-123",
        "call_id": "call-456",
        "summary": "Updated summary",
        "sentiment_score": -0.2,
        "sentiment_label": "negative",
        "key_moves": ["New move"],
        "is_resolved": False,
    }])

    client.table.return_value.upsert.return_value.execute.return_value = mock_result

    result = analysis_helpers.upsert_analysis(
        client,
        call_id="call-456",
        summary="Updated summary",
        sentiment_score=-0.2,
        sentiment_label="negative",
        key_moves=["New move"],
        is_resolved=False,
    )

    assert result["summary"] == "Updated summary"
    assert result["sentiment_score"] == -0.2


def test_upsert_analysis_raises_on_failure() -> None:
    """upsert_analysis should raise DatabaseError when upsert fails."""
    client = MagicMock()
    client.table.return_value.upsert.return_value.execute.return_value = SimpleNamespace(data=[])

    with pytest.raises(DatabaseError, match="Failed to upsert analysis"):
        analysis_helpers.upsert_analysis(
            client,
            call_id="call-456",
            summary="Test",
            sentiment_score=0.0,
            sentiment_label="neutral",
            key_moves=[],
            is_resolved=False,
        )


# =============================================================================
# get_analyses_by_call_ids tests
# =============================================================================


def test_get_analyses_by_call_ids_returns_multiple() -> None:
    """get_analyses_by_call_ids should return analyses for multiple calls."""
    client = MagicMock()

    mock_result = SimpleNamespace(data=[
        {
            "id": "analysis-1",
            "call_id": "call-1",
            "summary": "First call summary",
            "sentiment_score": 0.5,
            Tables.CALL_ANALYSIS_TOPICS: [
                {Tables.TOPICS: {"name": "billing"}},
                {Tables.TOPICS: {"name": "refund"}},
            ],
            Tables.CALL_ANALYSIS_KEYWORDS: [
                {Tables.KEYWORDS: {"word": "charge"}},
            ],
        },
        {
            "id": "analysis-2",
            "call_id": "call-2",
            "summary": "Second call summary",
            "sentiment_score": -0.3,
            Tables.CALL_ANALYSIS_TOPICS: [],
            Tables.CALL_ANALYSIS_KEYWORDS: [],
        },
    ])

    client.table.return_value.select.return_value.in_.return_value.execute.return_value = mock_result

    result = analysis_helpers.get_analyses_by_call_ids(client, ["call-1", "call-2"])

    # Verify query
    client.table.assert_called_with(Tables.CALL_ANALYSES)
    client.table.return_value.select.return_value.in_.assert_called_once_with(
        "call_id", ["call-1", "call-2"]
    )

    # Verify results
    assert len(result) == 2

    # First analysis has topics and keywords flattened
    assert result[0]["call_id"] == "call-1"
    assert result[0]["topics"] == ["billing", "refund"]
    assert result[0]["keywords"] == ["charge"]

    # Second analysis has empty topics and keywords
    assert result[1]["call_id"] == "call-2"
    assert result[1]["topics"] == []
    assert result[1]["keywords"] == []


def test_get_analyses_by_call_ids_returns_empty_for_no_matches() -> None:
    """get_analyses_by_call_ids should return empty list when no analyses found."""
    client = MagicMock()
    client.table.return_value.select.return_value.in_.return_value.execute.return_value = SimpleNamespace(data=[])

    result = analysis_helpers.get_analyses_by_call_ids(client, ["nonexistent-call"])

    assert result == []


def test_get_analyses_by_call_ids_returns_empty_for_empty_input() -> None:
    """get_analyses_by_call_ids should return empty list for empty call_ids."""
    client = MagicMock()

    result = analysis_helpers.get_analyses_by_call_ids(client, [])

    assert result == []
    # Should not call the database
    client.table.assert_not_called()


def test_get_analyses_by_call_ids_handles_partial_matches() -> None:
    """get_analyses_by_call_ids should return only calls that have analyses."""
    client = MagicMock()

    # Only one of two requested calls has an analysis
    mock_result = SimpleNamespace(data=[
        {
            "id": "analysis-1",
            "call_id": "call-1",
            "summary": "Has analysis",
            Tables.CALL_ANALYSIS_TOPICS: [],
            Tables.CALL_ANALYSIS_KEYWORDS: [],
        },
    ])

    client.table.return_value.select.return_value.in_.return_value.execute.return_value = mock_result

    result = analysis_helpers.get_analyses_by_call_ids(client, ["call-1", "call-2"])

    # Only the call with analysis is returned
    assert len(result) == 1
    assert result[0]["call_id"] == "call-1"
