"""Sample transcript helpers."""

import random

from supabase import Client

from .constants import Tables
from .decorators import db_operation
from .exceptions import NotFoundError


@db_operation
def get_random_sample_transcript(client: Client) -> dict:
    """Return one random sample transcript."""
    result = client.table(Tables.SAMPLE_TRANSCRIPTS).select("*").execute()
    if not result.data:
        raise NotFoundError("No sample transcripts found")

    return random.choice(result.data)
