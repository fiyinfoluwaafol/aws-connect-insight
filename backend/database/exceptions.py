"""Database exceptions."""

class DatabaseError(Exception):
    """Base database exception."""
    pass


class NotFoundError(DatabaseError):
    """Record not found."""
    pass


class DuplicateError(DatabaseError):
    """Record already exists."""
    pass


class AuthenticationError(DatabaseError):
    """Invalid credentials or token."""
    pass
