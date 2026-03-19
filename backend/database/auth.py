"""Authentication helpers."""

from supabase import Client

from .decorators import auth_operation
from .exceptions import AuthenticationError


@auth_operation
def create_auth_user(client: Client, email: str, password: str) -> dict:
    """Create a Supabase Auth user. Email is auto-confirmed."""
    response = client.auth.admin.create_user(
        {"email": email, "password": password, "email_confirm": True}
    )
    return {"id": response.user.id, "email": response.user.email}


@auth_operation
def authenticate_user(client: Client, email: str, password: str) -> dict:
    """Sign in with email and password. Returns {user, session}."""
    response = client.auth.sign_in_with_password({"email": email, "password": password})
    return {"user": response.user, "session": response.session}


@auth_operation
def get_current_user(client: Client, access_token: str) -> dict:
    """Verify token and return user info."""
    response = client.auth.get_user(access_token)
    if not response.user:
        raise AuthenticationError("Invalid or expired token")
    return {"id": response.user.id, "email": response.user.email}


@auth_operation
def sign_out(client: Client, access_token: str) -> bool:
    """End a user session."""
    client.auth.admin.sign_out(access_token)
    return True
