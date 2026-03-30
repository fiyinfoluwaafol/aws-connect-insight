"""Database operation decorators."""

from functools import wraps

from supabase import Client

from .exceptions import AuthenticationError, ClientError, DatabaseError, NotFoundError


def db_operation(func):
    """Decorator for database operations. Raises DatabaseError on failure."""

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


def auth_operation(func):
    """Decorator for auth operations. Raises AuthenticationError on failure."""

    @wraps(func)
    def wrapper(client: Client, *args, **kwargs):
        if client is None:
            raise ClientError("Database client is not initialized")
        try:
            return func(client, *args, **kwargs)
        except AuthenticationError:
            raise
        except Exception as e:
            raise AuthenticationError(f"{func.__name__} failed: {e}")

    return wrapper
