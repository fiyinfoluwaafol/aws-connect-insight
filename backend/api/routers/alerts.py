"""Alert management endpoints for supervisors."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator

from api.dependencies import get_current_user, get_supabase_client
from database.alerts import (
    DEFAULT_RECURRING_MIN_OCCURRENCES,
    DEFAULT_RECURRING_WINDOW_DAYS,
    create_alert_rule,
    get_alert_rule_by_id,
    list_alert_rules,
    list_alerts,
    update_alert,
    update_alert_rule,
)
from database.constants import AlertRuleType, AlertSeverity, AlertStatus
from database.exceptions import DatabaseError, NotFoundError

router = APIRouter()


class AlertRuleResponse(BaseModel):
    """API contract for alert rules."""

    id: str
    type: AlertRuleType
    severity: AlertSeverity
    is_active: bool
    team_id: str
    supervisor_id: str
    sentiment_below: float | None = None
    keyword: str | None = None
    topic: str | None = None
    min_occurrences: int | None = None
    window_days: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AlertResponse(BaseModel):
    """API contract for alert records."""

    id: str
    rule_id: str | None = None
    type: str
    severity: AlertSeverity
    status: AlertStatus
    is_read: bool
    call_id: str | None = None
    matched_value: str | None = None
    matched_count: int | None = None
    window_days: int | None = None
    title: str
    description: str
    created_at: str | None = None
    updated_at: str | None = None


class AlertsListResponse(BaseModel):
    """Paginated alert listing response."""

    alerts: list[AlertResponse]
    total: int
    page: int
    per_page: int


class AlertRulesListResponse(BaseModel):
    """Alert rule listing response."""

    rules: list[AlertRuleResponse]


class AlertRuleCreateRequest(BaseModel):
    """Create payload for automated alert rules."""

    type: AlertRuleType
    severity: AlertSeverity
    is_active: bool = True
    sentiment_below: float | None = Field(default=None, le=1.0, ge=-1.0)
    keyword: str | None = None
    topic: str | None = None
    min_occurrences: int | None = Field(default=None, ge=1)
    window_days: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_rule_shape(self) -> "AlertRuleCreateRequest":
        """Ensure only the right criteria fields are used for each rule type."""
        if self.type == AlertRuleType.SENTIMENT_THRESHOLD:
            if self.sentiment_below is None:
                raise ValueError("sentiment_below is required for sentiment_threshold rules")
            self.keyword = None
            self.topic = None
            self.min_occurrences = None
            self.window_days = None
            return self

        if self.type == AlertRuleType.KEYWORD_MATCH:
            if not self.keyword or not self.keyword.strip():
                raise ValueError("keyword is required for keyword_match rules")
            self.sentiment_below = None
            self.topic = None
            self.min_occurrences = None
            self.window_days = None
            return self

        if self.type == AlertRuleType.RECURRING_TOPIC:
            if not self.topic or not self.topic.strip():
                raise ValueError("topic is required for recurring_topic rules")
            self.sentiment_below = None
            self.keyword = None
            if self.min_occurrences is None:
                self.min_occurrences = DEFAULT_RECURRING_MIN_OCCURRENCES
            if self.window_days is None:
                self.window_days = DEFAULT_RECURRING_WINDOW_DAYS
            return self

        if not self.keyword or not self.keyword.strip():
            raise ValueError("keyword is required for recurring_keyword rules")
        self.sentiment_below = None
        self.topic = None
        if self.min_occurrences is None:
            self.min_occurrences = DEFAULT_RECURRING_MIN_OCCURRENCES
        if self.window_days is None:
            self.window_days = DEFAULT_RECURRING_WINDOW_DAYS
        return self


class AlertRulePatchRequest(BaseModel):
    """Patch payload for automated alert rules."""

    type: AlertRuleType | None = None
    severity: AlertSeverity | None = None
    is_active: bool | None = None
    sentiment_below: float | None = Field(default=None, le=1.0, ge=-1.0)
    keyword: str | None = None
    topic: str | None = None
    min_occurrences: int | None = Field(default=None, ge=1)
    window_days: int | None = Field(default=None, ge=1)


class AlertPatchRequest(BaseModel):
    """Patch payload for alert state changes."""

    status: AlertStatus | None = None
    is_read: bool | None = None

    @model_validator(mode="after")
    def ensure_any_field(self) -> "AlertPatchRequest":
        """Require at least one mutable field."""
        if self.status is None and self.is_read is None:
            raise ValueError("At least one field must be provided")
        return self


def _require_client(client: Any) -> Any:
    """Ensure the database client is available."""
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )
    return client


def _require_supervisor_context(current_user: dict) -> tuple[str, str]:
    """Return supervisor and team IDs for a valid supervisor user."""
    role = current_user.get("role")
    if role != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible to supervisors",
        )

    team_id = current_user.get("team_id")
    if not team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a team",
        )

    supervisor_id = current_user.get("id")
    return supervisor_id, team_id


def _validated_rule_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize a full rule payload through the create validator."""
    validated = AlertRuleCreateRequest.model_validate(data)
    return validated.model_dump(mode="json")


@router.get("", response_model=AlertsListResponse)
def get_alerts(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
    status_filter: Annotated[AlertStatus | None, Query(alias="status")] = None,
    severity: AlertSeverity | None = None,
    alert_type: Annotated[str | None, Query(alias="type")] = None,
    is_read: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AlertsListResponse:
    """List alerts for the current supervisor's team."""
    db_client = _require_client(client)
    supervisor_id, team_id = _require_supervisor_context(current_user)

    try:
        result = list_alerts(
            db_client,
            team_id=team_id,
            supervisor_id=supervisor_id,
            status=status_filter.value if status_filter else None,
            severity=severity.value if severity else None,
            alert_type=alert_type,
            is_read=is_read,
            page=page,
            per_page=per_page,
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch alerts",
        ) from exc

    return AlertsListResponse(**result)


@router.patch("/{alert_id}", response_model=AlertResponse)
def patch_alert(
    alert_id: str,
    payload: AlertPatchRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> AlertResponse:
    """Update an alert's status and/or read state."""
    db_client = _require_client(client)
    supervisor_id, team_id = _require_supervisor_context(current_user)

    try:
        updated = update_alert(
            db_client,
            alert_id=alert_id,
            team_id=team_id,
            supervisor_id=supervisor_id,
            fields=payload.model_dump(exclude_none=True),
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update alert",
        ) from exc

    return AlertResponse(**updated)


@router.get("/rules", response_model=AlertRulesListResponse)
def get_rules(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
    is_active: bool | None = None,
) -> AlertRulesListResponse:
    """List alert rules for the current supervisor's team."""
    db_client = _require_client(client)
    supervisor_id, team_id = _require_supervisor_context(current_user)

    try:
        rules = list_alert_rules(
            db_client,
            team_id=team_id,
            supervisor_id=supervisor_id,
            is_active=is_active,
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch alert rules",
        ) from exc

    return AlertRulesListResponse(rules=[AlertRuleResponse(**rule) for rule in rules])


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
def post_rule(
    payload: AlertRuleCreateRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> AlertRuleResponse:
    """Create a new automated alert rule."""
    db_client = _require_client(client)
    supervisor_id, team_id = _require_supervisor_context(current_user)

    try:
        created = create_alert_rule(
            db_client,
            supervisor_id=supervisor_id,
            team_id=team_id,
            rule_type=payload.type.value,
            severity=payload.severity.value,
            is_active=payload.is_active,
            sentiment_below=payload.sentiment_below,
            keyword=payload.keyword,
            topic=payload.topic,
            min_occurrences=payload.min_occurrences,
            window_days=payload.window_days,
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create alert rule",
        ) from exc

    return AlertRuleResponse(**created)


@router.patch("/rules/{rule_id}", response_model=AlertRuleResponse)
def patch_rule(
    rule_id: str,
    payload: AlertRulePatchRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> AlertRuleResponse:
    """Update an existing automated alert rule."""
    db_client = _require_client(client)
    supervisor_id, team_id = _require_supervisor_context(current_user)

    patch_data = payload.model_dump(exclude_unset=True)
    if not patch_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field must be provided",
        )

    try:
        current_rule = get_alert_rule_by_id(
            db_client,
            rule_id=rule_id,
            team_id=team_id,
            supervisor_id=supervisor_id,
        )
        merged = {
            "type": current_rule.get("type"),
            "severity": current_rule.get("severity"),
            "is_active": current_rule.get("is_active", True),
            "sentiment_below": current_rule.get("sentiment_below"),
            "keyword": current_rule.get("keyword"),
            "topic": current_rule.get("topic"),
            "min_occurrences": current_rule.get("min_occurrences"),
            "window_days": current_rule.get("window_days"),
            **patch_data,
        }
        normalized = _validated_rule_payload(merged)
        updated = update_alert_rule(
            db_client,
            rule_id=rule_id,
            team_id=team_id,
            supervisor_id=supervisor_id,
            fields=normalized,
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update alert rule",
        ) from exc

    return AlertRuleResponse(**updated)
