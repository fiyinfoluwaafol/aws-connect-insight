"""
Sequential test script for database helpers.

Run from backend directory:
    python -m database.samples.test_helpers

Requires:
    - .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    - Empty or test database (will create test records)
"""

import os
import sys
import time
from pathlib import Path

# Setup paths
backend = Path(__file__).parent.parent.parent
project_root = backend.parent
sys.path.insert(0, str(backend))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from database import auth, calls, teams, users  # noqa: E402
from database.constants import Role, SortOrder, Tables  # noqa: E402

load_dotenv(project_root / ".env")

# Create client with service role key (needed for admin operations)
client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

########################################
# TEST CONFIGURATION - Change these for each run
########################################
TEST_EMAIL = "test_user_11@example.com"
TEST_SUPERVISOR_EMAIL = "supervisor11@test.io"
TEST_PASSWORD = "password123"
TEST_TEAM_NAME = "Test Team Kilo"
AUTH_DELAY = 5  # seconds between auth user creations
########################################


def wait():
    input("\n  Press Enter to continue...")


def print_step(msg):
    print(f"  ✓ {msg}")


def print_section(name):
    print(f"\n{'=' * 50}")
    print(f" {name}")
    print(f"{'=' * 50}")


# Track created IDs for reference
created = {}

try:
    # ==================== CREATE ALL AUTH USERS FIRST ====================
    print_section("0. SETUP - Creating Auth Users")
    print("  (Creating all auth users upfront to avoid rate limits)\n")

    # Create agent auth user
    print("  → Creating auth user for agent...")
    auth_user = auth.create_auth_user(client, TEST_EMAIL, TEST_PASSWORD)
    created["auth_user_id"] = auth_user["id"]
    print_step(f"Agent auth user created → id: {auth_user['id']}")

    # Wait before creating second auth user
    print(f"\n  (waiting {AUTH_DELAY}s before creating supervisor auth user...)")
    time.sleep(AUTH_DELAY)

    # Create supervisor auth user
    print("  → Creating auth user for supervisor...")
    supervisor_auth = auth.create_auth_user(client, TEST_SUPERVISOR_EMAIL, TEST_PASSWORD)
    created["supervisor_auth_id"] = supervisor_auth["id"]
    print_step(f"Supervisor auth user created → id: {supervisor_auth['id']}")

    wait()

    # ==================== AUTH ====================
    print_section("1. AUTH HELPERS")

    # Authenticate
    print("\n  → Testing: authenticate_user")
    session = auth.authenticate_user(client, TEST_EMAIL, TEST_PASSWORD)
    token = session["session"].access_token
    print_step("authenticate_user → got session token")
    wait()

    # Get current user
    print("\n  → Testing: get_current_user")
    current = auth.get_current_user(client, token)
    print_step(f"get_current_user → email: {current['email']}")
    wait()

    # ==================== USERS ====================
    print_section("2. USER HELPERS")

    # Create user profile (agent)
    print("\n  → Testing: create_user (agent)")
    user = users.create_user(
        client,
        user_id=auth_user["id"],
        email=TEST_EMAIL,
        first_name="Test",
        last_name="Agent",
        role=Role.AGENT,
    )
    created["user_id"] = user["id"]
    print_step(f"create_user (agent) → id: {user['id']}")
    wait()

    # Get user by ID
    print("\n  → Testing: get_user_by_id")
    fetched = users.get_user_by_id(client, user["id"])
    print_step(f"get_user_by_id → name: {fetched['first_name']} {fetched['last_name']}")
    wait()

    # ==================== TEAMS ====================
    print_section("3. TEAM HELPERS")

    # Create supervisor profile
    print("\n  → Testing: create_user (supervisor)")
    supervisor = users.create_user(
        client,
        user_id=supervisor_auth["id"],
        email=TEST_SUPERVISOR_EMAIL,
        first_name="Test",
        last_name="Supervisor",
        role=Role.SUPERVISOR,
    )
    created["supervisor_id"] = supervisor["id"]
    print_step(f"create_user (supervisor) → id: {supervisor['id']}")
    wait()

    # Create team
    print("\n  → Testing: create_team")
    team = teams.create_team(client, TEST_TEAM_NAME, supervisor_id=supervisor["id"])
    created["team_id"] = team["id"]
    print_step(f"create_team → id: {team['id']}")
    wait()

    # Get team by ID
    print("\n  → Testing: get_team_by_id")
    fetched = teams.get_team_by_id(client, team["id"])
    print_step(f"get_team_by_id → name: {fetched['name']}")
    wait()

    # Add agent to team
    print("\n  → Testing: add_agent_to_team")
    teams.add_agent_to_team(client, agent_id=user["id"], team_id=team["id"])
    print_step("add_agent_to_team → agent added to team")
    wait()

    # Get users by team
    print("\n  → Testing: get_users_by_team")
    team_users = users.get_users_by_team(client, team["id"])
    print_step(f"get_users_by_team → count: {len(team_users)}")
    wait()

    # ==================== CALLS ====================
    print_section("4. CALL HELPERS")

    # Create call 1
    print("\n  → Testing: create_call #1")
    call1 = calls.create_call(
        client,
        agent_id=user["id"],
        team_id=team["id"],
        recording_url="https://storage.example.com/call1.mp3",
        duration_seconds=180,
        started_at="2026-03-01T10:30:00Z",
    )
    created["call1_id"] = call1["id"]
    print_step(f"create_call #1 → id: {call1['id']}")
    wait()

    # Create call 2
    print("\n  → Testing: create_call #2")
    call2 = calls.create_call(
        client,
        agent_id=user["id"],
        team_id=team["id"],
        recording_url="https://storage.example.com/call2.mp3",
        duration_seconds=240,
        started_at="2026-03-02T14:00:00Z",
    )
    created["call2_id"] = call2["id"]
    print_step(f"create_call #2 → id: {call2['id']}")
    wait()

    # Update call with transcript
    print("\n  → Testing: update_call (add transcript)")
    transcript = [
        {"speaker": "agent", "text": "Hello, thank you for calling. How can I help?"},
        {"speaker": "customer", "text": "Hi, I have an issue with my account."},
        {"speaker": "agent", "text": "I'd be happy to help you with that."},
    ]
    updated = calls.update_call_transcript(client, call1["id"], transcript)
    print_step(f"update_call → added transcript with {len(transcript)} turns")
    wait()

    # Get call by ID (includes call_analyses if exists)
    print("\n  → Testing: get_call_by_id")
    fetched = calls.get_call_by_id(client, call1["id"])
    print_step(f"get_call_by_id → has transcript: {fetched.get('transcript') is not None}")
    print_step(f"get_call_by_id → call_analyses: {fetched.get('call_analyses')}")
    wait()

    # Create a call_analyses record for testing
    print("\n  → Creating call_analyses record (direct DB call)")
    client.table(Tables.CALL_ANALYSES).insert(
        {
            "call_id": call1["id"],
            "summary": "Customer had an account issue, agent resolved it.",
            "sentiment_score": 0.75,
            "sentiment_label": "positive",
            "is_resolved": True,
        }
    ).execute()
    print_step("call_analyses created")
    wait()

    # Search calls (basic)
    print("\n  → Testing: search_calls (all)")
    results = calls.search_calls(client, team_id=team["id"])
    print_step(f"search_calls (all) → count: {results['total']}")
    wait()

    # Search calls (by agent)
    print("\n  → Testing: search_calls (by agent)")
    results = calls.search_calls(client, team_id=team["id"], agent_id=user["id"])
    print_step(f"search_calls (by agent) → count: {results['total']}")
    wait()

    # Search calls (by date range)
    # This tests that date_to is INCLUSIVE of the full day
    # call1 = March 1st 10:30 AM, call2 = March 2nd 2:00 PM
    # Both should be included when searching March 1 to March 2
    print("\n  → Testing: search_calls (date range - both days)")
    results = calls.search_calls(
        client,
        team_id=team["id"],
        date_from="2026-03-01",
        date_to="2026-03-02",
    )
    expected = 2
    actual = results["total"]
    if actual != expected:
        raise AssertionError(f"date range test failed: expected {expected}, got {actual}")
    print_step(f"search_calls (date range) → count: {actual} (expected {expected})")
    wait()

    # Search calls (date_to edge case - end of day inclusion)
    # Searching only March 2nd should include call2 (which is at 2:00 PM)
    print("\n  → Testing: search_calls (date_to includes full day)")
    results = calls.search_calls(
        client,
        team_id=team["id"],
        date_from="2026-03-02",
        date_to="2026-03-02",
    )
    expected = 1
    actual = results["total"]
    if actual != expected:
        raise AssertionError(f"date_to edge case failed: expected {expected}, got {actual}")
    print_step(f"search_calls (single day) → count: {actual} (expected {expected})")
    wait()

    # Search calls (sorted oldest first)
    print("\n  → Testing: search_calls (sort oldest)")
    results = calls.search_calls(client, team_id=team["id"], sort=SortOrder.OLDEST)
    print_step(f"search_calls (sort oldest) → count: {results['total']}")
    wait()

    # ==================== SIGN OUT ====================
    print_section("5. CLEANUP")

    print("\n  → Testing: sign_out")
    auth.sign_out(client, token)
    print_step("sign_out → session ended")
    wait()

    # ==================== SUMMARY ====================
    print_section("TEST COMPLETE")
    print("\nCreated records:")
    for key, value in created.items():
        print(f"  {key}: {value}")
    print("\n⚠️  Remember to clean up test data from your database!")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\nCreated records before failure:")
    for key, value in created.items():
        print(f"  {key}: {value}")
    raise
