"""Database constants and enums."""

from enum import Enum


class Tables:
    """Table names."""

    CALLS = "calls"
    CALL_ANALYSES = "call_analyses"
    CALL_ANALYSIS_TOPICS = "call_analysis_topics"
    CALL_ANALYSIS_KEYWORDS = "call_analysis_keywords"
    SAMPLE_TRANSCRIPTS = "sample_transcripts"
    TOPICS = "topics"
    KEYWORDS = "keywords"
    ALERT_CONFIGURATIONS = "alert_configurations"
    ALERTS = "alerts"
    USERS = "users"
    TEAMS = "teams"


class Role(Enum):
    """User roles."""

    AGENT = "agent"
    SUPERVISOR = "supervisor"


class SortOrder(Enum):
    """Sort options for search."""

    RECENT = "recent"
    OLDEST = "oldest"


class AlertRuleType(str, Enum):
    """Supported automated alert rule types."""

    SENTIMENT_THRESHOLD = "sentiment_threshold"
    KEYWORD_MATCH = "keyword_match"
    RECURRING_TOPIC = "recurring_topic"
    RECURRING_KEYWORD = "recurring_keyword"


class AlertSeverity(str, Enum):
    """Supported alert severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AlertStatus(str, Enum):
    """Supported alert lifecycle states."""

    OPEN = "open"
    CLOSED = "closed"
