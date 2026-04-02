"""Automated alert rule evaluation."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from database import alerts as alert_helpers
from database import analysis as analysis_helpers
from database.constants import AlertRuleType


def _normalize_values(values: list[str] | dict[str, bool] | None) -> set[str]:
    """Normalize topics/keywords to a lowercase comparable set."""
    if values is None:
        return set()

    if isinstance(values, dict):
        raw_values = values.keys()
    else:
        raw_values = values

    normalized: set[str] = set()
    for value in raw_values:
        normalized_value = alert_helpers.normalize_match_value(str(value))
        if normalized_value:
            normalized.add(normalized_value)
    return normalized


def _parse_iso_datetime(value: str) -> datetime:
    """Parse ISO timestamps that may include a trailing Z."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _window_start(started_at: str, window_days: int) -> str:
    """Return the inclusive window start ISO timestamp."""
    event_time = _parse_iso_datetime(started_at)
    return (event_time - timedelta(days=window_days)).isoformat()


def _count_recent_dimension_occurrences(
    analyses: list[dict[str, Any]],
    key: str,
) -> Counter[str]:
    """Count normalized topic/keyword occurrences across analyses."""
    counts: Counter[str] = Counter()

    for analysis in analyses:
        raw_values = analysis.get(key) or []
        for value in _normalize_values(raw_values):
            counts[value] += 1

    return counts


def _upsert_call_level_alert(
    client: Any,
    *,
    rule: dict[str, Any],
    call_id: str,
    supervisor_id: str,
    team_id: str,
    title: str,
    description: str,
    matched_value: str | None = None,
) -> dict[str, Any]:
    """Create or update the single call-level alert for a rule and call."""
    existing = alert_helpers.get_alert_for_rule_and_call(
        client,
        rule_id=rule["id"],
        call_id=call_id,
        team_id=team_id,
        supervisor_id=supervisor_id,
        alert_type=rule["type"],
    )
    payload = {
        "severity": rule["severity"],
        "title": title,
        "description": description,
        "matched_value": matched_value,
    }

    if existing:
        return alert_helpers.update_generated_alert(
            client,
            alert_id=existing["id"],
            fields=payload,
        )

    return alert_helpers.create_alert(
        client,
        rule_id=rule["id"],
        call_id=call_id,
        supervisor_id=supervisor_id,
        team_id=team_id,
        alert_type=rule["type"],
        severity=rule["severity"],
        title=title,
        description=description,
        matched_value=matched_value,
    )


def _upsert_recurring_alert(
    client: Any,
    *,
    rule: dict[str, Any],
    supervisor_id: str,
    team_id: str,
    matched_value: str,
    matched_count: int,
    title: str,
    description: str,
) -> dict[str, Any]:
    """Create or update the single open recurring alert for a matched value."""
    existing = alert_helpers.get_open_recurring_alert(
        client,
        rule_id=rule["id"],
        matched_value=matched_value,
        team_id=team_id,
        supervisor_id=supervisor_id,
    )
    payload = {
        "severity": rule["severity"],
        "title": title,
        "description": description,
        "matched_value": matched_value,
        "matched_count": matched_count,
        "window_days": rule["window_days"],
    }

    if existing:
        return alert_helpers.update_generated_alert(
            client,
            alert_id=existing["id"],
            fields=payload,
        )

    return alert_helpers.create_alert(
        client,
        rule_id=rule["id"],
        call_id=None,
        supervisor_id=supervisor_id,
        team_id=team_id,
        alert_type=rule["type"],
        severity=rule["severity"],
        title=title,
        description=description,
        matched_value=matched_value,
        matched_count=matched_count,
        window_days=rule["window_days"],
    )


def evaluate_alert_rules_for_call(
    client: Any,
    *,
    team_id: str,
    supervisor_id: str,
    call_id: str,
    started_at: str,
    sentiment_score: float,
    topics: list[str],
    keywords: dict[str, bool] | list[str],
) -> list[dict[str, Any]]:
    """Evaluate active team rules against a newly analyzed call."""
    triggered_alerts: list[dict[str, Any]] = []
    normalized_topics = _normalize_values(topics)
    normalized_keywords = _normalize_values(keywords)
    rules = alert_helpers.list_alert_rules(
        client,
        team_id=team_id,
        supervisor_id=supervisor_id,
        is_active=True,
    )

    analyses_by_window: dict[int, list[dict[str, Any]]] = {}

    def get_recent_analyses(window_days: int) -> list[dict[str, Any]]:
        if window_days not in analyses_by_window:
            call_ids = alert_helpers.get_recent_call_ids(
                client,
                team_id=team_id,
                started_at_from=_window_start(started_at, window_days),
                started_at_to=started_at,
            )
            analyses_by_window[window_days] = analysis_helpers.get_analyses_by_call_ids(
                client,
                call_ids,
            )
        return analyses_by_window[window_days]

    for rule in rules:
        rule_type = rule["type"]

        if rule_type == AlertRuleType.SENTIMENT_THRESHOLD.value:
            threshold = rule.get("sentiment_below")
            if threshold is None or sentiment_score >= threshold:
                continue

            triggered_alerts.append(
                _upsert_call_level_alert(
                    client,
                    rule=rule,
                    call_id=call_id,
                    supervisor_id=supervisor_id,
                    team_id=team_id,
                    title="Negative sentiment threshold breached",
                    description=(
                        f"Call sentiment score {sentiment_score:.2f} fell below "
                        f"the configured threshold of {threshold:.2f}."
                    ),
                )
            )
            continue

        if rule_type == AlertRuleType.KEYWORD_MATCH.value:
            keyword = alert_helpers.normalize_match_value(rule.get("keyword"))
            if not keyword or keyword not in normalized_keywords:
                continue

            triggered_alerts.append(
                _upsert_call_level_alert(
                    client,
                    rule=rule,
                    call_id=call_id,
                    supervisor_id=supervisor_id,
                    team_id=team_id,
                    title="Tracked keyword detected",
                    description=f'Call matched the tracked keyword "{keyword}".',
                    matched_value=keyword,
                )
            )
            continue

        if rule_type == AlertRuleType.RECURRING_TOPIC.value:
            topic = alert_helpers.normalize_match_value(rule.get("topic"))
            if not topic or topic not in normalized_topics:
                continue

            analyses = get_recent_analyses(rule["window_days"])
            counts = _count_recent_dimension_occurrences(analyses, "topics")
            matched_count = counts.get(topic, 0)
            if matched_count < rule["min_occurrences"]:
                continue

            triggered_alerts.append(
                _upsert_recurring_alert(
                    client,
                    rule=rule,
                    supervisor_id=supervisor_id,
                    team_id=team_id,
                    matched_value=topic,
                    matched_count=matched_count,
                    title="Recurring topic detected",
                    description=(
                        f'Topic "{topic}" appeared in {matched_count} calls within '
                        f'the last {rule["window_days"]} days.'
                    ),
                )
            )
            continue

        if rule_type == AlertRuleType.RECURRING_KEYWORD.value:
            keyword = alert_helpers.normalize_match_value(rule.get("keyword"))
            if not keyword or keyword not in normalized_keywords:
                continue

            analyses = get_recent_analyses(rule["window_days"])
            counts = _count_recent_dimension_occurrences(analyses, "keywords")
            matched_count = counts.get(keyword, 0)
            if matched_count < rule["min_occurrences"]:
                continue

            triggered_alerts.append(
                _upsert_recurring_alert(
                    client,
                    rule=rule,
                    supervisor_id=supervisor_id,
                    team_id=team_id,
                    matched_value=keyword,
                    matched_count=matched_count,
                    title="Recurring keyword detected",
                    description=(
                        f'Keyword "{keyword}" appeared in {matched_count} calls within '
                        f'the last {rule["window_days"]} days.'
                    ),
                )
            )

    return triggered_alerts
