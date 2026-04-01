#!/usr/bin/env python3
"""
Quick script to create a team and assign an existing supervisor to it.

Usage:
    python backend/database/samples/assign-supervisor-to-team.py <supervisor_email>

Example:
    python backend/database/samples/assign-supervisor-to-team.py supervisor@example.com
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Load .env from project root
project_root = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(project_root / ".env")

supabase = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
)


def assign_supervisor_to_team(supervisor_email: str):
    """Create a team and assign the supervisor to it."""

    # Step 1: Find the supervisor user
    print(f"Looking up supervisor: {supervisor_email}")
    result = supabase.table("users").select("*").eq("email", supervisor_email).execute()

    if not result.data:
        print(f"❌ Error: No user found with email {supervisor_email}")
        sys.exit(1)

    supervisor = result.data[0]

    if supervisor.get("role") != "supervisor":
        print(f"❌ Error: User {supervisor_email} is not a supervisor (role: {supervisor.get('role')})")
        sys.exit(1)

    print(f"✓ Found supervisor: {supervisor['first_name']} {supervisor['last_name']}")

    # Step 2: Check if supervisor already has a team
    if supervisor.get("team_id"):
        print(f"✓ Supervisor is already assigned to team: {supervisor['team_id']}")
        return

    # Step 3: Create a new team
    team_name = f"{supervisor['first_name']}'s Team"
    print(f"Creating team: {team_name}")

    team = (
        supabase.table("teams")
        .insert({
            "name": team_name,
            "supervisor_id": supervisor["id"]
        })
        .execute()
        .data[0]
    )

    print(f"✓ Created team: {team['name']} (ID: {team['id']})")

    # Step 4: Assign supervisor to the team
    print(f"Assigning supervisor to team...")

    supabase.table("users").update({
        "team_id": team["id"]
    }).eq("id", supervisor["id"]).execute()

    print(f"✓ Supervisor assigned to team!")
    print(f"\n✅ Done! Supervisor can now access the dashboard.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assign-supervisor-to-team.py <supervisor_email>")
        print("Example: python assign-supervisor-to-team.py supervisor@example.com")
        sys.exit(1)

    supervisor_email = sys.argv[1]
    assign_supervisor_to_team(supervisor_email)
