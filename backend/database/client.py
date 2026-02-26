"""Supabase client."""

import os
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    """Returns the Supabase client."""
    
    # Global to avoid making multiple connections
    global _client 
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _client = create_client(url, key)
    return _client
