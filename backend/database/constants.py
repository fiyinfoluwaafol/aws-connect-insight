"""Database constants and enums."""

from enum import Enum


class Tables:
    """Table names."""

    CALLS = "calls"
    CALL_ANALYSES = "call_analyses"
    CALL_ANALYSIS_TOPICS = "call_analysis_topics"
    CALL_ANALYSIS_KEYWORDS = "call_analysis_keywords"
    TOPICS = "topics"
    KEYWORDS = "keywords"
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
