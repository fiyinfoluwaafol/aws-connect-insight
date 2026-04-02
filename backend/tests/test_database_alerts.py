"""Unit tests for alert database helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from database import alerts as alert_helpers
from database.constants import AlertStatus, Tables
from database.exceptions import NotFoundError


def test_normalize_match_value_lowercases_and_trims() -> None:
    """normalize_match_value should lowercase and trim values."""
    assert alert_helpers.normalize_match_value(" Refund ") == "refund"
    assert alert_helpers.normalize_match_value("   ") is None
    assert alert_helpers.normalize_match_value(None) is None


def test_create_alert_rule_normalizes_fields_and_defaults_recurrence() -> None:
    """create_alert_rule should normalize keyword/topic fields and apply defaults."""
    client = MagicMock()
    client.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "rule-1"}]
    )

    alert_helpers.create_alert_rule(
        client,
        supervisor_id="sup-1",
        team_id="team-1",
        rule_type="recurring_keyword",
        severity="high",
        keyword=" Refund ",
        topic=" Billing ",
    )

    client.table.assert_called_once_with(Tables.ALERT_CONFIGURATIONS)
    client.table.return_value.insert.assert_called_once_with(
        {
            "supervisor_id": "sup-1",
            "team_id": "team-1",
            "type": "recurring_keyword",
            "severity": "high",
            "is_active": True,
            "sentiment_below": None,
            "keyword": "refund",
            "topic": "billing",
            "min_occurrences": alert_helpers.DEFAULT_RECURRING_MIN_OCCURRENCES,
            "window_days": alert_helpers.DEFAULT_RECURRING_WINDOW_DAYS,
        }
    )


def test_list_alerts_applies_filters_and_pagination() -> None:
    """list_alerts should apply team scoping, filters, and pagination."""
    client = MagicMock()
    select_query = MagicMock()
    query = MagicMock()
    select_query.eq.return_value = query
    query.eq.return_value = query
    query.order.return_value = query
    query.range.return_value.execute.return_value = SimpleNamespace(data=[], count=0)
    client.table.return_value.select.return_value = select_query

    result = alert_helpers.list_alerts(
        client,
        team_id="team-1",
        supervisor_id="sup-1",
        status="open",
        severity="medium",
        alert_type="keyword_match",
        is_read=False,
        page=2,
        per_page=10,
    )

    client.table.assert_called_once_with(Tables.ALERTS)
    select_query.eq.assert_called_once_with("team_id", "team-1")
    assert query.eq.call_args_list[0].args == ("supervisor_id", "sup-1")
    assert query.eq.call_args_list[1].args == ("status", "open")
    assert query.eq.call_args_list[2].args == ("severity", "medium")
    assert query.eq.call_args_list[3].args == ("type", "keyword_match")
    assert query.eq.call_args_list[4].args == ("is_read", False)
    query.range.assert_called_once_with(10, 19)
    assert result == {"alerts": [], "total": 0, "page": 2, "per_page": 10}


def test_update_alert_rule_normalizes_topic_and_keyword() -> None:
    """update_alert_rule should normalize mutable match values."""
    client = MagicMock()
    (
        client.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value
    ) = SimpleNamespace(data=[{"id": "rule-1"}])

    alert_helpers.update_alert_rule(
        client,
        rule_id="rule-1",
        team_id="team-1",
        supervisor_id="sup-1",
        fields={"keyword": " Cancel ", "topic": " Billing "},
    )

    client.table.assert_called_once_with(Tables.ALERT_CONFIGURATIONS)
    client.table.return_value.update.assert_called_once_with(
        {
            "keyword": "cancel",
            "topic": "billing",
            "min_occurrences": alert_helpers.DEFAULT_RECURRING_MIN_OCCURRENCES,
            "window_days": alert_helpers.DEFAULT_RECURRING_WINDOW_DAYS,
        }
    )


def test_update_alert_rule_applies_defaults_when_null_recurrence_fields_are_provided() -> None:
    """update_alert_rule should replace null recurrence fields with database-safe defaults."""
    client = MagicMock()
    (
        client.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value
    ) = SimpleNamespace(data=[{"id": "rule-1"}])

    alert_helpers.update_alert_rule(
        client,
        rule_id="rule-1",
        team_id="team-1",
        supervisor_id="sup-1",
        fields={"sentiment_below": 1.0, "min_occurrences": None, "window_days": None},
    )

    client.table.return_value.update.assert_called_once_with(
        {
            "sentiment_below": 1.0,
            "min_occurrences": alert_helpers.DEFAULT_RECURRING_MIN_OCCURRENCES,
            "window_days": alert_helpers.DEFAULT_RECURRING_WINDOW_DAYS,
        }
    )


def test_get_open_recurring_alert_normalizes_matched_value() -> None:
    """get_open_recurring_alert should normalize the matched value lookup."""
    client = MagicMock()
    (
        client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value
    ) = SimpleNamespace(data=[{"id": "alert-1"}])

    result = alert_helpers.get_open_recurring_alert(
        client,
        rule_id="rule-1",
        matched_value=" Refund ",
        team_id="team-1",
        supervisor_id="sup-1",
    )

    assert result["id"] == "alert-1"
    assert result["rule_id"] is None


def test_update_alert_raises_not_found_for_missing_record() -> None:
    """update_alert should raise NotFoundError when no row matches the scope."""
    client = MagicMock()
    (
        client.table.return_value.update.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value
    ) = SimpleNamespace(data=[])

    with pytest.raises(NotFoundError, match="Alert alert-404 not found"):
        alert_helpers.update_alert(
            client,
            alert_id="alert-404",
            team_id="team-1",
            supervisor_id="sup-1",
            fields={"status": AlertStatus.CLOSED.value},
        )
