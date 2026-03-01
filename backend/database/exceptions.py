"""Database exceptions."""


class DatabaseError(Exception):
    """Base database exception."""

    pass


class ClientError(Exception):
    """Issues with the client object that's been passed into the helper function"""

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
