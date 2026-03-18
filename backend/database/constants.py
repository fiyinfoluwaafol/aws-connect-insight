"""Database constants and enums."""

from enum import Enum


class Tables:
    """Table names."""

    CALLS = "calls"
    USERS = "users"
    TEAMS = "teams"


class Role(Enum):
    """User roles."""

    AGENT = "agent"
    SUPERVISOR = "supervisor"
