#!/usr/bin/env python3
"""
Quick script to add agents to a supervisor's team.

Usage:
    python backend/database/samples/add-agents-to-team.py <supervisor_email> <agent_email1> [agent_email2] [agent_email3] ...

Example:
    python backend/database/samples/add-agents-to-team.py supervisor@example.com agent1@example.com agent2@example.com
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


def add_agents_to_team(supervisor_email: str, agent_emails: list[str]):
    """Add agents to the supervisor's team."""

    # Step 1: Find the supervisor and their team
    print(f"Looking up supervisor: {supervisor_email}")
    result = supabase.table("users").select("*").eq("email", supervisor_email).execute()

    if not result.data:
        print(f"❌ Error: No user found with email {supervisor_email}")
        sys.exit(1)

    supervisor = result.data[0]

    if supervisor.get("role") != "supervisor":
        print(f"❌ Error: User {supervisor_email} is not a supervisor (role: {supervisor.get('role')})")
        sys.exit(1)

    team_id = supervisor.get("team_id")
    if not team_id:
        print(f"❌ Error: Supervisor {supervisor_email} is not assigned to a team")
        print("Run assign-supervisor-to-team.py first")
        sys.exit(1)

    print(f"✓ Found supervisor: {supervisor['first_name']} {supervisor['last_name']}")
    print(f"✓ Team ID: {team_id}")

    # Step 2: Add each agent to the team
    print(f"\nAdding {len(agent_emails)} agent(s) to team...")

    for agent_email in agent_emails:
        print(f"\n  Processing: {agent_email}")

        # Find the agent
        result = supabase.table("users").select("*").eq("email", agent_email).execute()

        if not result.data:
            print(f"    ❌ No user found with email {agent_email}")
            continue

        agent = result.data[0]

        # Check if already in a team
        if agent.get("team_id"):
            if agent["team_id"] == team_id:
                print(f"    ⚠️  Already in this team")
            else:
                print(f"    ⚠️  Already in another team (ID: {agent['team_id']})")
            continue

        # Add to team
        supabase.table("users").update({
            "team_id": team_id
        }).eq("id", agent["id"]).execute()

        print(f"    ✓ Added: {agent.get('first_name', 'N/A')} {agent.get('last_name', 'N/A')}")

    print(f"\n✅ Done! Agents added to team.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python add-agents-to-team.py <supervisor_email> <agent_email1> [agent_email2] ...")
        print("Example: python add-agents-to-team.py supervisor@example.com agent1@example.com agent2@example.com")
        sys.exit(1)

    supervisor_email = sys.argv[1]
    agent_emails = sys.argv[2:]
    add_agents_to_team(supervisor_email, agent_emails)
