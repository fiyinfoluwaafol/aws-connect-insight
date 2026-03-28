"""Authentication helpers."""

from supabase import Client, create_client

from .decorators import auth_operation
from .exceptions import AuthenticationError


@auth_operation
def create_auth_user(client: Client, email: str, password: str) -> dict:
    """Create a Supabase Auth user. Email is auto-confirmed."""
    response = client.auth.admin.create_user(
        {"email": email, "password": password, "email_confirm": True}
    )
    if not response.user:
        raise AuthenticationError("Failed to create auth user")
    return {"id": response.user.id, "email": response.user.email}


@auth_operation
def authenticate_user(client: Client, email: str, password: str) -> dict:
    """Sign in with email and password."""
    response = client.auth.sign_in_with_password({"email": email, "password": password})
    if not response.user or not response.session:
        raise AuthenticationError("Invalid email or password")
    return {
        "user_id": response.user.id,
        "email": response.user.email,
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
    }


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


@auth_operation
def delete_auth_user(client: Client, user_id: str) -> bool:
    """Delete a Supabase Auth user."""
    client.auth.admin.delete_user(user_id)
    return True


@auth_operation
def refresh_auth_session(client: Client, refresh_token: str) -> dict:
    """Refresh a session from a refresh token."""
    response = client.auth.refresh_session(refresh_token)
    if not response.session:
        raise AuthenticationError("Invalid or expired refresh token")
    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
    }


@auth_operation
def send_password_reset_email(client: Client, email: str) -> bool:
    """Send a password reset email."""
    client.auth.reset_password_email(email)
    return True


@auth_operation
def get_auth_user_for_token(client: Client, access_token: str) -> dict:
    """Resolve a user from a token."""
    response = client.auth.get_user(access_token)
    if not response.user:
        raise AuthenticationError("Invalid or expired token")
    return {"id": response.user.id, "email": response.user.email}


@auth_operation
def update_auth_user_password(client: Client, user_id: str, new_password: str) -> bool:
    """Update a user's password."""
    client.auth.admin.update_user_by_id(user_id, {"password": new_password})
    return True


@auth_operation
def verify_user_password(client: Client, email: str, password: str) -> bool:
    """Check whether the supplied password is correct for the user."""
    # Use a short-lived client so sign-in does not replace the main client's
    # service-role authorization header before any admin API calls.
    verify_client = create_client(str(client.supabase_url), client.supabase_key)
    response = verify_client.auth.sign_in_with_password({"email": email, "password": password})
    if not response.user:
        raise AuthenticationError("Invalid email or password")
    return True
