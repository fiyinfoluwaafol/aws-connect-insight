#!/usr/bin/env python3
"""Populate sample_transcripts table from transcripts/all.json."""

import json
import os
import sys
import uuid
from pathlib import Path

from supabase import create_client


def main():
    """Load transcripts from JSON and insert into sample_transcripts table."""
    # Get Supabase credentials from environment
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    # Initialize Supabase client
    client = create_client(supabase_url, supabase_key)

    # Load transcripts from JSON file
    script_dir = Path(__file__).parent
    json_path = script_dir.parent / "transcripts" / "all.json"

    if not json_path.exists():
        print(f"Error: Transcripts file not found at {json_path}")
        sys.exit(1)

    print(f"Loading transcripts from {json_path}...")
    with open(json_path) as f:
        data = json.load(f)

    print(f"Found {len(data)} transcripts")

    # Insert each transcript into the database
    inserted_count = 0
    for item in data:
        source_transcript_id = item.get("id")
        turns = item.get("transcript", {}).get("turns", [])

        if not source_transcript_id or not turns:
            print(f"Warning: Transcript {item.get('id')} is missing required data, skipping")
            continue

        sample_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"sample-transcript:{source_transcript_id}"))

        # Upsert into sample_transcripts table using a deterministic UUID so reruns stay idempotent.
        try:
            client.table("sample_transcripts").upsert(
                {
                    "id": sample_id,
                    "transcript": turns,
                },
                on_conflict="id",
            ).execute()
            inserted_count += 1

            if inserted_count % 10 == 0:
                print(f"Inserted {inserted_count}/{len(data)} transcripts...")

        except Exception as e:
            print(f"Error inserting transcript {item.get('id')}: {e}")
            continue

    print(f"\nComplete! Upserted {inserted_count} transcripts into sample_transcripts table")


if __name__ == "__main__":
    main()
