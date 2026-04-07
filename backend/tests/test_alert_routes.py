"""API tests for supervisor alert routes."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api import dependencies
from api.main import app as _app


@pytest.fixture
def supervisor_user():
    """Authenticated supervisor user for alert route tests."""
    return {
        "id": "sup-123",
        "email": "supervisor@example.com",
        "team_id": "team-456",
        "role": "supervisor",
    }


@pytest.fixture
def agent_user():
    """Authenticated agent user for authorization tests."""
    return {
        "id": "agent-123",
        "email": "agent@example.com",
        "team_id": "team-456",
        "role": "agent",
    }


@pytest.fixture
def user_without_team():
    """Authenticated supervisor without a team assignment."""
    return {
        "id": "sup-123",
        "email": "supervisor@example.com",
        "team_id": None,
        "role": "supervisor",
    }


def _build_client(mock_supabase: MagicMock, user: dict | None) -> TestClient:
    def _override_get_supabase_client():
        yield mock_supabase

    _app.dependency_overrides[dependencies.get_supabase_client] = _override_get_supabase_client

    if user is not None:
        _app.dependency_overrides[dependencies.get_current_user] = lambda: user
    else:
        _app.dependency_overrides.pop(dependencies.get_current_user, None)

    client = TestClient(_app)
    if user is not None:
        client.cookies.set("access_token", "valid-token")
    return client


@pytest.fixture
def authenticated_supervisor_client(mock_supabase: MagicMock, supervisor_user: dict):
    client = _build_client(mock_supabase, supervisor_user)
    yield client
    client.close()
    _app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client(mock_supabase: MagicMock):
    client = _build_client(mock_supabase, None)
    yield client
    client.close()
    _app.dependency_overrides.clear()


@pytest.fixture
def authenticated_agent_client(mock_supabase: MagicMock, agent_user: dict):
    client = _build_client(mock_supabase, agent_user)
    yield client
    client.close()
    _app.dependency_overrides.clear()


@pytest.fixture
def client_without_team(mock_supabase: MagicMock, user_without_team: dict):
    client = _build_client(mock_supabase, user_without_team)
    yield client
    client.close()
    _app.dependency_overrides.clear()


def test_get_alerts_returns_paginated_results(
    authenticated_supervisor_client: TestClient,
) -> None:
    """GET /api/alerts should return filtered, paginated alerts."""
    with patch("api.routers.alerts.list_alerts") as list_alerts_mock:
        list_alerts_mock.return_value = {
            "alerts": [
                {
                    "id": "alert-1",
                    "rule_id": "rule-1",
                    "type": "keyword_match",
                    "severity": "high",
                    "status": "open",
                    "is_read": False,
                    "call_id": "call-1",
                    "matched_value": "refund",
                    "matched_count": None,
                    "window_days": None,
                    "title": "Tracked keyword detected",
                    "description": "Call matched the tracked keyword \"refund\".",
                    "created_at": "2026-04-02T12:00:00Z",
                    "updated_at": "2026-04-02T12:00:00Z",
                }
            ],
            "total": 1,
            "page": 1,
            "per_page": 20,
        }

        response = authenticated_supervisor_client.get(
            "/api/alerts?status=open&severity=high&type=keyword_match&is_read=false"
        )

        assert response.status_code == 200
        assert response.json()["total"] == 1
        list_alerts_mock.assert_called_once()
        assert list_alerts_mock.call_args.kwargs["team_id"] == "team-456"
        assert list_alerts_mock.call_args.kwargs["supervisor_id"] == "sup-123"
        assert list_alerts_mock.call_args.kwargs["status"] == "open"


def test_patch_alert_updates_status_or_read_flag(
    authenticated_supervisor_client: TestClient,
) -> None:
    """PATCH /api/alerts/{id} should update an alert in scope."""
    with patch("api.routers.alerts.update_alert") as update_alert_mock:
        update_alert_mock.return_value = {
            "id": "alert-1",
            "rule_id": "rule-1",
            "type": "keyword_match",
            "severity": "medium",
            "status": "closed",
            "is_read": True,
            "call_id": "call-1",
            "matched_value": "refund",
            "matched_count": None,
            "window_days": None,
            "title": "Tracked keyword detected",
            "description": "Call matched the tracked keyword \"refund\".",
        }

        response = authenticated_supervisor_client.patch(
            "/api/alerts/alert-1",
            json={"status": "closed", "is_read": True},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "closed"
        update_alert_mock.assert_called_once()


def test_post_manual_alert_creates_alert(
    authenticated_supervisor_client: TestClient,
) -> None:
    """POST /api/alerts/manual should create a manual supervisor alert."""
    with (
        patch("api.routers.alerts.fetch_call_by_id") as fetch_call_mock,
        patch("api.routers.alerts.get_open_alert_for_call") as get_open_alert_mock,
        patch("api.routers.alerts.get_user_by_id") as get_user_mock,
        patch("api.routers.alerts.create_alert") as create_alert_mock,
    ):
        fetch_call_mock.return_value = {
            "id": "call-1",
            "agent_id": "agent-1",
            "team_id": "team-456",
            "started_at": "2026-04-02T12:00:00Z",
        }
        get_open_alert_mock.return_value = None
        get_user_mock.return_value = {
            "id": "agent-1",
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "ada@example.com",
        }
        create_alert_mock.return_value = {
            "id": "alert-manual",
            "rule_id": None,
            "type": "manual",
            "severity": "medium",
            "status": "open",
            "is_read": False,
            "call_id": "call-1",
            "matched_value": None,
            "matched_count": None,
            "window_days": None,
            "title": "Manual review requested",
            "description": (
                "Supervisor manually flagged Ada Lovelace's call "
                "from 2026-04-02T12:00:00Z for review."
            ),
        }

        response = authenticated_supervisor_client.post(
            "/api/alerts/manual",
            json={"call_id": "call-1"},
        )

        assert response.status_code == 201
        assert response.json()["type"] == "manual"
        create_alert_mock.assert_called_once()


def test_post_manual_alert_rejects_duplicate_open_alert(
    authenticated_supervisor_client: TestClient,
) -> None:
    """POST /api/alerts/manual should reject calls that already have an open alert."""
    with (
        patch("api.routers.alerts.fetch_call_by_id") as fetch_call_mock,
        patch("api.routers.alerts.get_open_alert_for_call") as get_open_alert_mock,
    ):
        fetch_call_mock.return_value = {
            "id": "call-1",
            "agent_id": "agent-1",
            "team_id": "team-456",
            "started_at": "2026-04-02T12:00:00Z",
        }
        get_open_alert_mock.return_value = {"id": "alert-1"}

        response = authenticated_supervisor_client.post(
            "/api/alerts/manual",
            json={"call_id": "call-1"},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "This call already has an open alert"


def test_get_alert_calls_returns_related_calls(
    authenticated_supervisor_client: TestClient,
) -> None:
    """GET /api/alerts/{id}/calls should return related call detail."""
    with (
        patch("api.routers.alerts.get_alert_by_id") as get_alert_mock,
        patch("api.routers.alerts.get_alert_rule_by_id") as get_rule_mock,
        patch("api.routers.alerts.get_related_call_ids_for_alert") as get_related_call_ids_mock,
        patch("api.routers.alerts._build_call_detail_response") as build_call_mock,
    ):
        get_alert_mock.return_value = {
            "id": "alert-1",
            "rule_id": "rule-1",
            "type": "recurring_keyword",
            "call_id": None,
        }
        get_rule_mock.return_value = {"id": "rule-1", "type": "recurring_keyword"}
        get_related_call_ids_mock.return_value = ["call-1", "call-2"]
        build_call_mock.side_effect = [
            {
                "id": "call-1",
                "agent_id": "agent-1",
                "agent_name": "Ada Lovelace",
                "started_at": "2026-04-02T12:00:00Z",
                "duration_seconds": 240,
                "sentiment_score": -0.4,
                "sentiment_label": "negative",
                "is_resolved": False,
                "topics": ["refund"],
                "summary": "Customer requested a refund.",
                "transcript": [],
                "has_open_alert": False,
                "open_alert_id": None,
            },
            {
                "id": "call-2",
                "agent_id": "agent-2",
                "agent_name": "Grace Hopper",
                "started_at": "2026-04-01T10:00:00Z",
                "duration_seconds": 180,
                "sentiment_score": -0.2,
                "sentiment_label": "negative",
                "is_resolved": True,
                "topics": ["refund"],
                "summary": "Repeat refund complaint.",
                "transcript": [],
                "has_open_alert": False,
                "open_alert_id": None,
            },
        ]

        response = authenticated_supervisor_client.get("/api/alerts/alert-1/calls")

        assert response.status_code == 200
        assert [call["id"] for call in response.json()["calls"]] == ["call-1", "call-2"]
        get_related_call_ids_mock.assert_called_once()


def test_get_rules_returns_active_and_inactive_rules(
    authenticated_supervisor_client: TestClient,
) -> None:
    """GET /api/alerts/rules should return team-scoped rules."""
    with patch("api.routers.alerts.list_alert_rules") as list_rules_mock:
        list_rules_mock.return_value = [
            {
                "id": "rule-1",
                "type": "sentiment_threshold",
                "severity": "high",
                "is_active": True,
                "team_id": "team-456",
                "supervisor_id": "sup-123",
                "sentiment_below": -0.4,
                "keyword": None,
                "topic": None,
                "min_occurrences": None,
                "window_days": None,
            },
            {
                "id": "rule-2",
                "type": "keyword_match",
                "severity": "medium",
                "is_active": False,
                "team_id": "team-456",
                "supervisor_id": "sup-123",
                "sentiment_below": None,
                "keyword": "refund",
                "topic": None,
                "min_occurrences": None,
                "window_days": None,
            },
        ]

        response = authenticated_supervisor_client.get("/api/alerts/rules")

        assert response.status_code == 200
        assert len(response.json()["rules"]) == 2
        list_rules_mock.assert_called_once()


def test_post_rule_creates_keyword_rule(
    authenticated_supervisor_client: TestClient,
) -> None:
    """POST /api/alerts/rules should create a valid rule."""
    with patch("api.routers.alerts.create_alert_rule") as create_rule_mock:
        create_rule_mock.return_value = {
            "id": "rule-1",
            "type": "keyword_match",
            "severity": "high",
            "is_active": True,
            "team_id": "team-456",
            "supervisor_id": "sup-123",
            "sentiment_below": None,
            "keyword": "refund",
            "topic": None,
            "min_occurrences": None,
            "window_days": None,
        }

        response = authenticated_supervisor_client.post(
            "/api/alerts/rules",
            json={"type": "keyword_match", "severity": "high", "keyword": "refund"},
        )

        assert response.status_code == 201
        assert response.json()["keyword"] == "refund"
        create_rule_mock.assert_called_once()


def test_post_rule_validates_required_fields(
    authenticated_supervisor_client: TestClient,
) -> None:
    """POST /api/alerts/rules should reject incomplete type-specific payloads."""
    response = authenticated_supervisor_client.post(
        "/api/alerts/rules",
        json={"type": "keyword_match", "severity": "high"},
    )

    assert response.status_code == 422


def test_patch_rule_merges_and_updates_rule(
    authenticated_supervisor_client: TestClient,
) -> None:
    """PATCH /api/alerts/rules/{id} should validate the merged rule state."""
    with (
        patch("api.routers.alerts.get_alert_rule_by_id") as get_rule_mock,
        patch("api.routers.alerts.update_alert_rule") as update_rule_mock,
    ):
        get_rule_mock.return_value = {
            "id": "rule-1",
            "type": "recurring_keyword",
            "severity": "medium",
            "is_active": True,
            "team_id": "team-456",
            "supervisor_id": "sup-123",
            "sentiment_below": None,
            "keyword": "refund",
            "topic": None,
            "min_occurrences": 3,
            "window_days": 7,
        }
        update_rule_mock.return_value = {
            **get_rule_mock.return_value,
            "severity": "high",
            "min_occurrences": 5,
        }

        response = authenticated_supervisor_client.patch(
            "/api/alerts/rules/rule-1",
            json={"severity": "high", "min_occurrences": 5},
        )

        assert response.status_code == 200
        assert response.json()["severity"] == "high"
        assert update_rule_mock.call_args.kwargs["fields"]["keyword"] == "refund"


def test_alert_routes_require_authentication(unauthenticated_client: TestClient) -> None:
    """Protected alert routes should require authentication."""
    response = unauthenticated_client.get("/api/alerts")

    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


def test_alert_routes_require_supervisor_role(
    authenticated_agent_client: TestClient,
) -> None:
    """Alert routes should reject authenticated agents."""
    response = authenticated_agent_client.get("/api/alerts")

    assert response.status_code == 403
    assert "only accessible to supervisors" in response.json()["detail"]


def test_alert_routes_require_team_assignment(client_without_team: TestClient) -> None:
    """Alert routes should reject supervisors without a team."""
    response = client_without_team.get("/api/alerts")

    assert response.status_code == 403
    assert "not assigned to a team" in response.json()["detail"]
