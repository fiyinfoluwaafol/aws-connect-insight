"""Unit tests for automated alert evaluation."""

from unittest.mock import MagicMock

import pytest

from database.constants import AlertRuleType
from services import alerts as alert_service


def test_evaluate_alert_rules_triggers_sentiment_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sentiment rules should trigger when the score falls below threshold."""
    create_alert = MagicMock(return_value={"id": "alert-1"})

    monkeypatch.setattr(
        alert_service.alert_helpers,
        "list_alert_rules",
        MagicMock(
            return_value=[
                {
                    "id": "rule-1",
                    "type": AlertRuleType.SENTIMENT_THRESHOLD.value,
                    "severity": "high",
                    "sentiment_below": -0.3,
                }
            ]
        ),
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_alert_for_rule_and_call",
        MagicMock(return_value=None),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "create_alert", create_alert)

    result = alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-1",
        started_at="2026-04-02T12:00:00",
        sentiment_score=-0.45,
        topics=["Refund"],
        keywords={"refund": True},
    )

    assert result == [{"id": "alert-1"}]
    create_alert.assert_called_once()
    assert create_alert.call_args.kwargs["alert_type"] == AlertRuleType.SENTIMENT_THRESHOLD.value


def test_evaluate_alert_rules_skips_non_matching_keyword_rule(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keyword rules should not trigger when the keyword is absent."""
    create_alert = MagicMock()

    monkeypatch.setattr(
        alert_service.alert_helpers,
        "list_alert_rules",
        MagicMock(
            return_value=[
                {
                    "id": "rule-1",
                    "type": AlertRuleType.KEYWORD_MATCH.value,
                    "severity": "medium",
                    "keyword": "chargeback",
                }
            ]
        ),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "create_alert", create_alert)

    result = alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-1",
        started_at="2026-04-02T12:00:00",
        sentiment_score=-0.45,
        topics=["Refund"],
        keywords={"refund": True},
    )

    assert result == []
    create_alert.assert_not_called()


def test_evaluate_alert_rules_normalizes_keyword_matches(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keyword comparisons should be lowercase-normalized on both sides."""
    create_alert = MagicMock(return_value={"id": "alert-1"})

    monkeypatch.setattr(
        alert_service.alert_helpers,
        "list_alert_rules",
        MagicMock(
            return_value=[
                {
                    "id": "rule-1",
                    "type": AlertRuleType.KEYWORD_MATCH.value,
                    "severity": "medium",
                    "keyword": "refund",
                }
            ]
        ),
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_alert_for_rule_and_call",
        MagicMock(return_value=None),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "create_alert", create_alert)

    result = alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-1",
        started_at="2026-04-02T12:00:00",
        sentiment_score=0.1,
        topics=["Billing"],
        keywords={"Refund": True},
    )

    assert result == [{"id": "alert-1"}]
    assert create_alert.call_args.kwargs["matched_value"] == "refund"


def test_evaluate_alert_rules_triggers_recurring_topic(monkeypatch: pytest.MonkeyPatch) -> None:
    """Recurring topic rules should trigger once the threshold is met."""
    create_alert = MagicMock(return_value={"id": "alert-2"})
    recent_call_ids = MagicMock(return_value=["call-1", "call-2", "call-3"])
    recent_analyses = MagicMock(
        return_value=[
            {"topics": ["refund"], "keywords": ["refund"]},
            {"topics": ["Refund"], "keywords": []},
            {"topics": ["billing", "refund"], "keywords": []},
        ]
    )

    monkeypatch.setattr(
        alert_service.alert_helpers,
        "list_alert_rules",
        MagicMock(
            return_value=[
                {
                    "id": "rule-topic",
                    "type": AlertRuleType.RECURRING_TOPIC.value,
                    "severity": "high",
                    "topic": "refund",
                    "min_occurrences": 3,
                    "window_days": 7,
                }
            ]
        ),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "get_recent_call_ids", recent_call_ids)
    monkeypatch.setattr(
        alert_service.analysis_helpers,
        "get_analyses_by_call_ids",
        recent_analyses,
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_open_recurring_alert",
        MagicMock(return_value=None),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "create_alert", create_alert)

    result = alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-3",
        started_at="2026-04-02T12:00:00",
        sentiment_score=0.1,
        topics=["Refund"],
        keywords={"refund": True},
    )

    assert result == [{"id": "alert-2"}]
    assert create_alert.call_args.kwargs["matched_count"] == 3
    assert create_alert.call_args.kwargs["matched_value"] == "refund"


def test_evaluate_alert_rules_updates_existing_open_recurring_alert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Recurring rules should update the existing open alert instead of duplicating it."""
    update_alert = MagicMock(return_value={"id": "alert-open"})

    monkeypatch.setattr(
        alert_service.alert_helpers,
        "list_alert_rules",
        MagicMock(
            return_value=[
                {
                    "id": "rule-keyword",
                    "type": AlertRuleType.RECURRING_KEYWORD.value,
                    "severity": "medium",
                    "keyword": "refund",
                    "min_occurrences": 3,
                    "window_days": 7,
                }
            ]
        ),
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_recent_call_ids",
        MagicMock(return_value=["call-1", "call-2", "call-3"]),
    )
    monkeypatch.setattr(
        alert_service.analysis_helpers,
        "get_analyses_by_call_ids",
        MagicMock(
            return_value=[
                {"topics": [], "keywords": ["refund"]},
                {"topics": [], "keywords": ["Refund"]},
                {"topics": [], "keywords": ["refund"]},
            ]
        ),
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_open_recurring_alert",
        MagicMock(return_value={"id": "alert-open"}),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "update_generated_alert", update_alert)
    monkeypatch.setattr(alert_service.alert_helpers, "create_alert", MagicMock())

    result = alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-3",
        started_at="2026-04-02T12:00:00",
        sentiment_score=0.1,
        topics=["billing"],
        keywords={"Refund": True},
    )

    assert result == [{"id": "alert-open"}]
    update_alert.assert_called_once()


def test_evaluate_alert_rules_retriggers_closed_recurring_alert_as_new(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Closed recurring alerts should retrigger as new alerts when the threshold is met again."""
    create_alert = MagicMock(return_value={"id": "alert-new"})

    monkeypatch.setattr(
        alert_service.alert_helpers,
        "list_alert_rules",
        MagicMock(
            return_value=[
                {
                    "id": "rule-keyword",
                    "type": AlertRuleType.RECURRING_KEYWORD.value,
                    "severity": "medium",
                    "keyword": "refund",
                    "min_occurrences": 3,
                    "window_days": 7,
                }
            ]
        ),
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_recent_call_ids",
        MagicMock(return_value=["call-1", "call-2", "call-3"]),
    )
    monkeypatch.setattr(
        alert_service.analysis_helpers,
        "get_analyses_by_call_ids",
        MagicMock(
            return_value=[
                {"topics": [], "keywords": ["refund"]},
                {"topics": [], "keywords": ["refund"]},
                {"topics": [], "keywords": ["refund"]},
            ]
        ),
    )
    monkeypatch.setattr(
        alert_service.alert_helpers,
        "get_open_recurring_alert",
        MagicMock(return_value=None),
    )
    monkeypatch.setattr(alert_service.alert_helpers, "create_alert", create_alert)

    result = alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-3",
        started_at="2026-04-02T12:00:00",
        sentiment_score=0.1,
        topics=["billing"],
        keywords={"refund": True},
    )

    assert result == [{"id": "alert-new"}]
    create_alert.assert_called_once()


def test_evaluate_alert_rules_requests_only_active_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    """The evaluator should request only active rules from the helper layer."""
    list_rules = MagicMock(return_value=[])
    monkeypatch.setattr(alert_service.alert_helpers, "list_alert_rules", list_rules)

    alert_service.evaluate_alert_rules_for_call(
        MagicMock(),
        team_id="team-1",
        supervisor_id="sup-1",
        call_id="call-1",
        started_at="2026-04-02T12:00:00",
        sentiment_score=0.0,
        topics=[],
        keywords={},
    )

    assert list_rules.call_args.kwargs["is_active"] is True
