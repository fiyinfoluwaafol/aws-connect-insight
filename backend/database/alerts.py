"""Alert rules and alert record helpers."""

from __future__ import annotations

from typing import Any

from supabase import Client

from .constants import AlertStatus, Tables
from .decorators import db_operation
from .exceptions import NotFoundError

DEFAULT_RECURRING_MIN_OCCURRENCES = 3
DEFAULT_RECURRING_WINDOW_DAYS = 7
MAX_PER_PAGE = 100


def normalize_match_value(value: str | None) -> str | None:
    """Normalize topic/keyword values for storage and comparisons."""
    if value is None:
        return None

    normalized = value.strip().lower()
    return normalized or None


def normalize_rule_record(rule: dict[str, Any]) -> dict[str, Any]:
    """Normalize rule records to the current API shape."""
    normalized = dict(rule)
    if normalized.get("severity") is None:
        normalized["severity"] = "medium"
    if normalized.get("min_occurrences") is None:
        normalized["min_occurrences"] = DEFAULT_RECURRING_MIN_OCCURRENCES
    if normalized.get("window_days") is None:
        normalized["window_days"] = DEFAULT_RECURRING_WINDOW_DAYS
    return normalized


def normalize_alert_record(alert: dict[str, Any]) -> dict[str, Any]:
    """Normalize alert records to the current API shape."""
    normalized = dict(alert)
    normalized.setdefault("rule_id", None)
    normalized.setdefault("matched_value", None)
    normalized.setdefault("matched_count", None)
    normalized.setdefault("window_days", None)
    return normalized


@db_operation
def list_alert_rules(
    client: Client,
    *,
    team_id: str,
    supervisor_id: str | None = None,
    is_active: bool | None = None,
) -> list[dict[str, Any]]:
    """List alert rules for a team and optional supervisor."""
    query = client.table(Tables.ALERT_CONFIGURATIONS).select("*").eq("team_id", team_id)

    if supervisor_id is not None:
        query = query.eq("supervisor_id", supervisor_id)
    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = query.order("created_at", desc=True).execute()
    return [normalize_rule_record(rule) for rule in (result.data or [])]


@db_operation
def get_alert_rule_by_id(
    client: Client,
    *,
    rule_id: str,
    team_id: str,
    supervisor_id: str,
) -> dict[str, Any]:
    """Return a single alert rule scoped to the supervisor's team."""
    result = (
        client.table(Tables.ALERT_CONFIGURATIONS)
        .select("*")
        .eq("id", rule_id)
        .eq("team_id", team_id)
        .eq("supervisor_id", supervisor_id)
        .execute()
    )
    if not result.data:
        raise NotFoundError(f"Alert rule {rule_id} not found")
    return normalize_rule_record(result.data[0])


@db_operation
def create_alert_rule(
    client: Client,
    *,
    supervisor_id: str,
    team_id: str,
    rule_type: str,
    severity: str,
    is_active: bool = True,
    sentiment_below: float | None = None,
    keyword: str | None = None,
    topic: str | None = None,
    min_occurrences: int | None = None,
    window_days: int | None = None,
) -> dict[str, Any]:
    """Create an alert rule."""
    payload: dict[str, Any] = {
        "supervisor_id": supervisor_id,
        "team_id": team_id,
        "type": rule_type,
        "severity": severity,
        "is_active": is_active,
        "sentiment_below": sentiment_below,
        "keyword": normalize_match_value(keyword),
        "topic": normalize_match_value(topic),
        "min_occurrences": min_occurrences,
        "window_days": window_days,
    }

    if payload["min_occurrences"] is None:
        payload["min_occurrences"] = DEFAULT_RECURRING_MIN_OCCURRENCES
    if payload["window_days"] is None:
        payload["window_days"] = DEFAULT_RECURRING_WINDOW_DAYS

    result = client.table(Tables.ALERT_CONFIGURATIONS).insert(payload).execute()
    return normalize_rule_record(result.data[0])


@db_operation
def update_alert_rule(
    client: Client,
    *,
    rule_id: str,
    team_id: str,
    supervisor_id: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    """Update an alert rule."""
    if not fields:
        raise ValueError("No fields to update")

    payload = dict(fields)
    if "keyword" in payload:
        payload["keyword"] = normalize_match_value(payload["keyword"])
    if "topic" in payload:
        payload["topic"] = normalize_match_value(payload["topic"])
    if payload.get("min_occurrences") is None:
        payload["min_occurrences"] = DEFAULT_RECURRING_MIN_OCCURRENCES
    if payload.get("window_days") is None:
        payload["window_days"] = DEFAULT_RECURRING_WINDOW_DAYS

    result = (
        client.table(Tables.ALERT_CONFIGURATIONS)
        .update(payload)
        .eq("id", rule_id)
        .eq("team_id", team_id)
        .eq("supervisor_id", supervisor_id)
        .execute()
    )
    if not result.data:
        raise NotFoundError(f"Alert rule {rule_id} not found")
    return normalize_rule_record(result.data[0])


@db_operation
def list_alerts(
    client: Client,
    *,
    team_id: str,
    supervisor_id: str,
    status: str | None = None,
    severity: str | None = None,
    alert_type: str | None = None,
    is_read: bool | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """List alerts scoped to the supervisor's team."""
    page = max(page, 1)
    per_page = min(max(per_page, 1), MAX_PER_PAGE)

    query = (
        client.table(Tables.ALERTS)
        .select("*", count="exact")
        .eq("team_id", team_id)
        .eq("supervisor_id", supervisor_id)
    )

    if status is not None:
        query = query.eq("status", status)
    if severity is not None:
        query = query.eq("severity", severity)
    if alert_type is not None:
        query = query.eq("type", alert_type)
    if is_read is not None:
        query = query.eq("is_read", is_read)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "alerts": [normalize_alert_record(alert) for alert in (result.data or [])],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@db_operation
def update_alert(
    client: Client,
    *,
    alert_id: str,
    team_id: str,
    supervisor_id: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    """Update an alert's read state and/or status."""
    if not fields:
        raise ValueError("No fields to update")

    result = (
        client.table(Tables.ALERTS)
        .update(fields)
        .eq("id", alert_id)
        .eq("team_id", team_id)
        .eq("supervisor_id", supervisor_id)
        .execute()
    )
    if not result.data:
        raise NotFoundError(f"Alert {alert_id} not found")
    return normalize_alert_record(result.data[0])


@db_operation
def create_alert(
    client: Client,
    *,
    rule_id: str,
    call_id: str | None,
    supervisor_id: str,
    team_id: str,
    alert_type: str,
    severity: str,
    title: str,
    description: str,
    matched_value: str | None = None,
    matched_count: int | None = None,
    window_days: int | None = None,
    is_read: bool = False,
    status: str = AlertStatus.OPEN.value,
) -> dict[str, Any]:
    """Create an alert record."""
    payload = {
        "rule_id": rule_id,
        "call_id": call_id,
        "supervisor_id": supervisor_id,
        "team_id": team_id,
        "type": alert_type,
        "severity": severity,
        "status": status,
        "title": title,
        "description": description,
        "is_read": is_read,
        "matched_value": normalize_match_value(matched_value),
        "matched_count": matched_count,
        "window_days": window_days,
    }

    result = client.table(Tables.ALERTS).insert(payload).execute()
    return normalize_alert_record(result.data[0])


@db_operation
def get_alert_for_rule_and_call(
    client: Client,
    *,
    rule_id: str,
    call_id: str,
    team_id: str,
    supervisor_id: str,
    alert_type: str | None = None,
) -> dict[str, Any] | None:
    """Return the alert generated by a call-level rule for the given call."""
    result = (
        client.table(Tables.ALERTS)
        .select("*")
        .eq("rule_id", rule_id)
        .eq("call_id", call_id)
        .eq("team_id", team_id)
        .eq("supervisor_id", supervisor_id)
        .execute()
    )
    row = (result.data or [None])[0]
    return normalize_alert_record(row) if row else None


@db_operation
def get_open_recurring_alert(
    client: Client,
    *,
    rule_id: str,
    matched_value: str,
    team_id: str,
    supervisor_id: str,
) -> dict[str, Any] | None:
    """Return the currently open recurring alert for a rule and value."""
    result = (
        client.table(Tables.ALERTS)
        .select("*")
        .eq("rule_id", rule_id)
        .eq("matched_value", normalize_match_value(matched_value))
        .eq("team_id", team_id)
        .eq("supervisor_id", supervisor_id)
        .eq("status", AlertStatus.OPEN.value)
        .execute()
    )
    row = (result.data or [None])[0]
    return normalize_alert_record(row) if row else None


@db_operation
def update_generated_alert(
    client: Client,
    *,
    alert_id: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    """Update an internally generated alert."""
    if not fields:
        raise ValueError("No fields to update")

    payload = dict(fields)
    if "matched_value" in payload:
        payload["matched_value"] = normalize_match_value(payload["matched_value"])

    result = client.table(Tables.ALERTS).update(payload).eq("id", alert_id).execute()
    if not result.data:
        raise NotFoundError(f"Alert {alert_id} not found")
    return normalize_alert_record(result.data[0])


@db_operation
def get_recent_call_ids(
    client: Client,
    *,
    team_id: str,
    started_at_from: str,
    started_at_to: str | None = None,
) -> list[str]:
    """Return call IDs for a team in the given time window."""
    query = (
        client.table(Tables.CALLS)
        .select("id")
        .eq("team_id", team_id)
        .gte("started_at", started_at_from)
    )
    if started_at_to is not None:
        query = query.lte("started_at", started_at_to)

    result = query.execute()
    return [row["id"] for row in (result.data or []) if row.get("id")]
