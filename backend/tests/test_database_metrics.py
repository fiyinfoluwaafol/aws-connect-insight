"""Unit tests for historical metrics database helpers."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

from database import metrics as metrics_helpers
from database.constants import Tables

# =============================================================================
# get_daily_metrics tests
# =============================================================================


def test_get_daily_metrics_aggregates_by_date() -> None:
    """get_daily_metrics should group calls by date and compute aggregates."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            # Day 1: Two calls (both analyzed)
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
            {
                "started_at": "2026-03-01T14:00:00",
                "duration_seconds": 200,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": -0.5, "sentiment_label": "negative"},
            },
            # Day 2: One call
            {
                "started_at": "2026-03-02T09:00:00",
                "duration_seconds": 400,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": 0.2, "sentiment_label": "neutral"},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 2),
    )

    assert len(result) == 2

    # Day 1 metrics
    day1 = result[0]
    assert day1["date"] == "2026-03-01"
    assert day1["call_count"] == 2
    assert day1["avg_sentiment"] == 0.0  # (0.5 + -0.5) / 2
    assert day1["avg_duration"] == 250  # (300 + 200) / 2
    assert day1["negative_call_percent"] == 50.0  # 1 of 2 analyzed calls

    # Day 2 metrics
    day2 = result[1]
    assert day2["date"] == "2026-03-02"
    assert day2["call_count"] == 1
    assert day2["avg_sentiment"] == 0.2
    assert day2["avg_duration"] == 400
    assert day2["negative_call_percent"] == 0.0


def test_get_daily_metrics_filters_by_team() -> None:
    """get_daily_metrics should apply team_id filter to query."""
    client = MagicMock()

    mock_query = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value
    ) = mock_query
    mock_query.eq.return_value.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        team_id="team-123",
    )

    mock_query.eq.assert_called_with("team_id", "team-123")


def test_get_daily_metrics_filters_by_agent() -> None:
    """get_daily_metrics should apply agent_id filter to query."""
    client = MagicMock()

    mock_query = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value
    ) = mock_query
    mock_query.eq.return_value.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        agent_id="agent-456",
    )

    mock_query.eq.assert_called_with("agent_id", "agent-456")


def test_get_daily_metrics_returns_empty_for_no_data() -> None:
    """get_daily_metrics should return empty list when no calls found."""
    client = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = SimpleNamespace(
        data=[]
    )

    result = metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert result == []


def test_get_daily_metrics_handles_missing_analysis() -> None:
    """get_daily_metrics should handle calls without analysis data."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: None,  # No analysis
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    assert len(result) == 1
    assert result[0]["call_count"] == 1
    assert result[0]["avg_sentiment"] is None  # No sentiment data
    assert result[0]["avg_duration"] == 300
    assert result[0]["negative_call_percent"] == 0.0  # No analyzed calls


def test_get_daily_metrics_handles_missing_duration() -> None:
    """get_daily_metrics should handle calls without duration."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": None,  # No duration
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    assert len(result) == 1
    assert result[0]["avg_duration"] is None


# =============================================================================
# get_metrics_summary tests
# =============================================================================


def test_get_metrics_summary_computes_totals() -> None:
    """get_metrics_summary should compute aggregates across all calls."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                Tables.CALL_ANALYSES: {"sentiment_score": 0.6, "sentiment_label": "positive"},
            },
            {
                "started_at": "2026-03-01T14:00:00",
                "duration_seconds": 200,
                Tables.CALL_ANALYSES: {"sentiment_score": -0.4, "sentiment_label": "negative"},
            },
            {
                "started_at": "2026-03-02T09:00:00",
                "duration_seconds": 400,
                Tables.CALL_ANALYSES: {"sentiment_score": 0.1, "sentiment_label": "neutral"},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 2),
    )

    assert result["total_calls"] == 3
    assert result["avg_sentiment"] == 0.1  # (0.6 + -0.4 + 0.1) / 3 = 0.1
    assert result["avg_duration"] == 300  # (300 + 200 + 400) / 3 = 300
    assert result["negative_call_percent"] == 33.3  # 1 of 3 analyzed calls

    assert result["sentiment_distribution"] == {
        "positive": 1,
        "neutral": 1,
        "negative": 1,
    }


def test_get_metrics_summary_filters_by_team() -> None:
    """get_metrics_summary should apply team_id filter to query."""
    client = MagicMock()

    mock_query = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value
    ) = mock_query
    mock_query.eq.return_value.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        team_id="team-123",
    )

    mock_query.eq.assert_called_with("team_id", "team-123")


def test_get_metrics_summary_filters_by_agent() -> None:
    """get_metrics_summary should apply agent_id filter to query."""
    client = MagicMock()

    mock_query = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value
    ) = mock_query
    mock_query.eq.return_value.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        agent_id="agent-456",
    )

    mock_query.eq.assert_called_with("agent_id", "agent-456")


def test_get_metrics_summary_returns_zeros_for_no_data() -> None:
    """get_metrics_summary should return zero counts when no calls found."""
    client = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = SimpleNamespace(
        data=[]
    )

    result = metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert result["total_calls"] == 0
    assert result["avg_sentiment"] is None
    assert result["avg_duration"] is None
    assert result["negative_call_percent"] == 0.0
    assert result["sentiment_distribution"] == {"positive": 0, "neutral": 0, "negative": 0}


def test_get_metrics_summary_handles_missing_analysis() -> None:
    """get_metrics_summary should handle calls without analysis data."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                Tables.CALL_ANALYSES: None,
            },
            {
                "started_at": "2026-03-01T14:00:00",
                "duration_seconds": 200,
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    assert result["total_calls"] == 2
    assert result["avg_sentiment"] == 0.5  # Only one call has sentiment
    assert result["avg_duration"] == 250  # Both have duration
    assert result["sentiment_distribution"]["positive"] == 1


# =============================================================================
# get_top_topics tests
# =============================================================================


def test_get_top_topics_counts_topics() -> None:
    """get_top_topics should count topic occurrences and sort by count."""
    client = MagicMock()

    # Mock calls query
    calls_result = SimpleNamespace(
        data=[
            {"id": "call-1"},
            {"id": "call-2"},
            {"id": "call-3"},
        ]
    )

    # Mock analyses query
    analyses_result = SimpleNamespace(
        data=[
            {"id": "analysis-1"},
            {"id": "analysis-2"},
            {"id": "analysis-3"},
        ]
    )

    # Mock topics query - billing appears twice, refund once
    topics_result = SimpleNamespace(
        data=[
            {"topic_id": "topic-1", Tables.TOPICS: {"name": "billing"}},
            {"topic_id": "topic-1", Tables.TOPICS: {"name": "billing"}},
            {"topic_id": "topic-2", Tables.TOPICS: {"name": "refund"}},
        ]
    )

    # Set up the mock chain
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = calls_result
    client.table.return_value.select.return_value.in_.return_value.execute.side_effect = [
        analyses_result,
        topics_result,
    ]

    result = metrics_helpers.get_top_topics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert len(result) == 2
    assert result[0] == {"name": "billing", "count": 2}
    assert result[1] == {"name": "refund", "count": 1}


def test_get_top_topics_returns_empty_for_no_calls() -> None:
    """get_top_topics should return empty list when no calls found."""
    client = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = SimpleNamespace(
        data=[]
    )

    result = metrics_helpers.get_top_topics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert result == []


def test_get_top_topics_respects_limit() -> None:
    """get_top_topics should limit results to specified count."""
    client = MagicMock()

    calls_result = SimpleNamespace(data=[{"id": "call-1"}])
    analyses_result = SimpleNamespace(data=[{"id": "analysis-1"}])
    topics_result = SimpleNamespace(
        data=[
            {"topic_id": "t1", Tables.TOPICS: {"name": "billing"}},
            {"topic_id": "t1", Tables.TOPICS: {"name": "billing"}},
            {"topic_id": "t1", Tables.TOPICS: {"name": "billing"}},
            {"topic_id": "t2", Tables.TOPICS: {"name": "refund"}},
            {"topic_id": "t2", Tables.TOPICS: {"name": "refund"}},
            {"topic_id": "t3", Tables.TOPICS: {"name": "shipping"}},
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = calls_result
    client.table.return_value.select.return_value.in_.return_value.execute.side_effect = [
        analyses_result,
        topics_result,
    ]

    result = metrics_helpers.get_top_topics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        limit=2,
    )

    assert len(result) == 2
    assert result[0]["name"] == "billing"
    assert result[1]["name"] == "refund"


def test_get_top_topics_filters_by_team() -> None:
    """get_top_topics should apply team_id filter to calls query."""
    client = MagicMock()

    mock_query = MagicMock()
    client.table.return_value.select.return_value.gte.return_value.lte.return_value = mock_query
    mock_query.eq.return_value.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_top_topics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        team_id="team-123",
    )

    mock_query.eq.assert_called_with("team_id", "team-123")


# =============================================================================
# get_agent_stats tests
# =============================================================================


def test_get_agent_stats_aggregates_by_agent() -> None:
    """get_agent_stats should aggregate metrics per agent."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "agent_id": "agent-1",
                Tables.USERS: {"first_name": "Jane", "last_name": "Doe"},
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5},
            },
            {
                "agent_id": "agent-1",
                Tables.USERS: {"first_name": "Jane", "last_name": "Doe"},
                Tables.CALL_ANALYSES: {"sentiment_score": 0.7},
            },
            {
                "agent_id": "agent-2",
                Tables.USERS: {"first_name": "John", "last_name": "Smith"},
                Tables.CALL_ANALYSES: {"sentiment_score": 0.3},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_agent_stats(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert len(result) == 2

    # Agent 1 has more calls, should be first
    assert result[0]["agent_id"] == "agent-1"
    assert result[0]["name"] == "Jane Doe"
    assert result[0]["call_count"] == 2
    assert result[0]["avg_sentiment"] == 0.6  # (0.5 + 0.7) / 2

    assert result[1]["agent_id"] == "agent-2"
    assert result[1]["name"] == "John Smith"
    assert result[1]["call_count"] == 1
    assert result[1]["avg_sentiment"] == 0.3


def test_get_agent_stats_returns_empty_for_no_data() -> None:
    """get_agent_stats should return empty list when no calls found."""
    client = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = SimpleNamespace(
        data=[]
    )

    result = metrics_helpers.get_agent_stats(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert result == []


def test_get_agent_stats_handles_missing_user_info() -> None:
    """get_agent_stats should handle missing user name gracefully."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "agent_id": "agent-1",
                Tables.USERS: None,  # No user info
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_agent_stats(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert len(result) == 1
    assert result[0]["name"] == "Unknown"


def test_get_agent_stats_handles_missing_analysis() -> None:
    """get_agent_stats should handle calls without analysis."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "agent_id": "agent-1",
                Tables.USERS: {"first_name": "Jane", "last_name": "Doe"},
                Tables.CALL_ANALYSES: None,  # No analysis
            },
            {
                "agent_id": "agent-1",
                Tables.USERS: {"first_name": "Jane", "last_name": "Doe"},
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_agent_stats(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert len(result) == 1
    assert result[0]["call_count"] == 2
    assert result[0]["avg_sentiment"] == 0.5  # Only one call has sentiment


def test_get_agent_stats_filters_by_team() -> None:
    """get_agent_stats should apply team_id filter to query."""
    client = MagicMock()

    mock_query = MagicMock()
    client.table.return_value.select.return_value.gte.return_value.lte.return_value = mock_query
    mock_query.eq.return_value.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_agent_stats(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        team_id="team-123",
    )

    mock_query.eq.assert_called_with("team_id", "team-123")


# =============================================================================
# _safe_average tests
# =============================================================================


def test_safe_average_returns_none_for_empty_list() -> None:
    """_safe_average should return None for empty list."""
    result = metrics_helpers._safe_average([])
    assert result is None


def test_safe_average_computes_average() -> None:
    """_safe_average should compute average correctly."""
    result = metrics_helpers._safe_average([1, 2, 3])
    assert result == 2.0


def test_safe_average_rounds_to_three_decimals() -> None:
    """_safe_average should round to 3 decimal places."""
    result = metrics_helpers._safe_average([1, 2])
    assert result == 1.5


def test_safe_average_returns_int_when_requested() -> None:
    """_safe_average should return integer when as_int=True."""
    result = metrics_helpers._safe_average([1.4, 2.6], as_int=True)
    assert result == 2
    assert isinstance(result, int)


# =============================================================================
# Edge case tests (from PR review)
# =============================================================================


def test_get_daily_metrics_negative_percent_uses_analyzed_calls() -> None:
    """negative_call_percent should be calculated from analyzed calls only, not total calls."""
    client = MagicMock()

    # 4 calls total, but only 2 have analysis. 1 of those 2 is negative.
    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": -0.5, "sentiment_label": "negative"},
            },
            {
                "started_at": "2026-03-01T11:00:00",
                "duration_seconds": 200,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
            {
                "started_at": "2026-03-01T12:00:00",
                "duration_seconds": 250,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: None,  # No analysis
            },
            {
                "started_at": "2026-03-01T13:00:00",
                "duration_seconds": 350,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: None,  # No analysis
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    assert len(result) == 1
    assert result[0]["call_count"] == 4  # Total calls
    # Negative percent should be 50% (1 negative out of 2 analyzed), NOT 25% (1 out of 4 total)
    assert result[0]["negative_call_percent"] == 50.0


def test_get_metrics_summary_negative_percent_uses_analyzed_calls() -> None:
    """negative_call_percent should be calculated from analyzed calls only, not total calls."""
    client = MagicMock()

    # 5 calls total, only 2 analyzed, 1 negative
    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                Tables.CALL_ANALYSES: {"sentiment_score": -0.5, "sentiment_label": "negative"},
            },
            {
                "started_at": "2026-03-01T11:00:00",
                "duration_seconds": 200,
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
            {
                "started_at": "2026-03-01T12:00:00",
                "duration_seconds": 250,
                Tables.CALL_ANALYSES: None,
            },
            {
                "started_at": "2026-03-01T13:00:00",
                "duration_seconds": 350,
                Tables.CALL_ANALYSES: None,
            },
            {
                "started_at": "2026-03-01T14:00:00",
                "duration_seconds": 400,
                Tables.CALL_ANALYSES: None,
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    assert result["total_calls"] == 5
    # Negative percent should be 50% (1 negative out of 2 analyzed), NOT 20% (1 out of 5 total)
    assert result["negative_call_percent"] == 50.0


def test_get_daily_metrics_skips_calls_without_started_at() -> None:
    """Calls without started_at should be skipped entirely."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
            {
                "started_at": None,  # Missing started_at
                "duration_seconds": 200,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": -0.5, "sentiment_label": "negative"},
            },
            {
                # Missing started_at key entirely
                "duration_seconds": 250,
                "agent_id": "agent-1",
                "team_id": "team-1",
                Tables.CALL_ANALYSES: {"sentiment_score": 0.2, "sentiment_label": "neutral"},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    # Only the first call should be counted
    assert len(result) == 1
    assert result[0]["call_count"] == 1


def test_get_metrics_summary_skips_calls_without_started_at() -> None:
    """Calls without started_at should be skipped entirely."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "started_at": "2026-03-01T10:00:00",
                "duration_seconds": 300,
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5, "sentiment_label": "positive"},
            },
            {
                "started_at": None,
                "duration_seconds": 200,
                Tables.CALL_ANALYSES: {"sentiment_score": -0.5, "sentiment_label": "negative"},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_metrics_summary(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 1),
    )

    # Only the first call should be counted
    assert result["total_calls"] == 1
    assert result["sentiment_distribution"]["positive"] == 1
    assert result["sentiment_distribution"]["negative"] == 0


def test_get_daily_metrics_filters_by_both_team_and_agent() -> None:
    """get_daily_metrics should apply both team_id and agent_id filters."""
    client = MagicMock()

    mock_query = MagicMock()
    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.limit.return_value
    ) = mock_query
    mock_query.eq.return_value = mock_query  # Allow chaining
    mock_query.execute.return_value = SimpleNamespace(data=[])

    metrics_helpers.get_daily_metrics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
        team_id="team-123",
        agent_id="agent-456",
    )

    # Both filters should be applied
    calls = mock_query.eq.call_args_list
    assert len(calls) == 2
    assert ("team_id", "team-123") in [c[0] for c in calls]
    assert ("agent_id", "agent-456") in [c[0] for c in calls]


def test_get_agent_stats_skips_calls_without_agent_id() -> None:
    """Calls without agent_id should be skipped in agent stats."""
    client = MagicMock()

    mock_result = SimpleNamespace(
        data=[
            {
                "agent_id": "agent-1",
                Tables.USERS: {"first_name": "Jane", "last_name": "Doe"},
                Tables.CALL_ANALYSES: {"sentiment_score": 0.5},
            },
            {
                "agent_id": None,  # No agent_id
                Tables.USERS: {"first_name": "Unknown", "last_name": ""},
                Tables.CALL_ANALYSES: {"sentiment_score": -0.5},
            },
        ]
    )

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = mock_result

    result = metrics_helpers.get_agent_stats(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    # Only agent-1 should be included
    assert len(result) == 1
    assert result[0]["agent_id"] == "agent-1"


def test_get_top_topics_returns_empty_for_no_analyses() -> None:
    """get_top_topics should return empty list when calls have no analyses."""
    client = MagicMock()

    # Calls exist but no analyses
    calls_result = SimpleNamespace(data=[{"id": "call-1"}, {"id": "call-2"}])
    analyses_result = SimpleNamespace(data=[])  # No analyses for these calls

    (
        client.table.return_value.select.return_value.gte.return_value.lte.return_value.execute.return_value
    ) = calls_result
    client.table.return_value.select.return_value.in_.return_value.execute.return_value = (
        analyses_result
    )

    result = metrics_helpers.get_top_topics(
        client,
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 7),
    )

    assert result == []
