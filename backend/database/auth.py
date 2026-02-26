"""Authentication helpers."""

from .client import get_client
from .exceptions import DatabaseError, AuthenticationError


def create_auth_user(email: str, password: str) -> dict:
    """
    Create a new Supabase Auth user. Returns {id, email}.
    Actual user would need to be created from the users.py module
    """
    try:
        supabase = get_client()
        response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        return {"id": response.user.id, "email": response.user.email}
    except Exception as e:
        raise DatabaseError(f"Failed to create auth user: {e}")


def authenticate_user(email: str, password: str) -> dict:
    """Authenticate user. Returns {user, session}. Could be used for a login endpoint"""
    try:
        supabase = get_client()
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return {"user": response.user, "session": response.session}
    except Exception as e:
        raise AuthenticationError(f"Authentication failed: {e}")


def get_current_user(access_token: str) -> dict:
    """Verify token and return user. Returns {id, email}."""
    try:
        supabase = get_client()
        response = supabase.auth.get_user(access_token)
    except Exception as e:
        raise AuthenticationError(f"Token verification failed: {e}")

    if not response.user:
        raise AuthenticationError("Invalid or expired token")
    return {"id": response.user.id, "email": response.user.email}


def sign_out(access_token: str) -> bool:
    """End user session."""
    try:
        supabase = get_client()
        supabase.auth.admin.sign_out(access_token)
        return True
    except Exception as e:
        raise DatabaseError(f"Sign out failed: {e}")
