"""Database enums file"""

from enum import Enum

class Role(Enum):
    """Role options for the user object"""
    AGENT = "agent"
    SUPERVISOR = "supervisor"
