"""Database utility functions."""

from functools import wraps

from supabase import Client

from .exceptions import AuthenticationError, ClientError, DatabaseError, NotFoundError


def with_db_client(func):
    """Decorator that handles client validation and error wrapping."""

    @wraps(func)
    def wrapper(client: Client, *args, **kwargs):
        if client is None:
            raise ClientError("Database client is not initialized")
        try:
            return func(client, *args, **kwargs)
        except (NotFoundError, AuthenticationError):
            raise
        except Exception as e:
            raise DatabaseError(f"{func.__name__} failed: {e}")

    return wrapper
