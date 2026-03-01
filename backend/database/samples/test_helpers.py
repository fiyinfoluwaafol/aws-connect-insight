"""
Script to test the database helpers
Run: python test_helpers.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from database import auth, calls, teams, users

# Setup paths
backend = Path(__file__).parent.parent.parent
project_root = backend.parent
sys.path.insert(0, str(backend))


load_dotenv(project_root / ".env")

# Create client
client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


########################################
# CHANGE THESE
TEST_EMAIL = "test7@example.com"
TEST_PASSWORD = "password123"
TEST_TEAM_NAME = "Team G"
########################################

# AUTH
print("\n[ AUTH ]")
auth_user = auth.create_auth_user(client, TEST_EMAIL, TEST_PASSWORD)
session = auth.authenticate_user(client, TEST_EMAIL, TEST_PASSWORD)
token = session["session"].access_token
auth.get_current_user(client, token)
print("done")

# USERS
print("\n[ USERS ]")
user = users.create_user(client, auth_user["id"], TEST_EMAIL, "Test", "User", "agent")
users.get_user_by_id(client, user["id"])
users.get_user_by_email(client, TEST_EMAIL)
print("done")

# TEAMS
print("\n[ TEAMS ]")
team = teams.create_team(client, TEST_TEAM_NAME, supervisor_id=user["id"])
teams.get_team_by_id(client, team["id"])
teams.add_member(client, team["id"], user["id"])
teams.get_team_members(client, team["id"])
users.get_users_by_team(client, team["id"])
teams.remove_member(client, user["id"])
print("done")

# CALLS
print("\n[ CALLS ]")
call1 = calls.create_call(
    client, user["id"], team["id"], "https://rec1.mp3", 120, "2024-01-15T10:30:00Z"
)
call2 = calls.create_call(
    client, user["id"], team["id"], "https://rec2.mp3", 180, "2024-01-16T14:00:00Z"
)
calls.get_call_by_id(client, call1["id"])
print("get_calls_by_agent:", len(calls.get_calls_by_agent(client, user["id"])))
print("get_calls_by_team:", len(calls.get_calls_by_team(client, team["id"])))
print(
    "get_recent_calls_by_team:",
    len(calls.get_recent_calls_by_team(client, team["id"], "2024-01-01T00:00:00Z")),
)
print(
    "get_calls_in_range_by_team:",
    len(
        calls.get_calls_in_range_by_team(
            client, team["id"], "2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z"
        )
    ),
)

# DONE
print("\n[ DONE ]")
auth.sign_out(client, token)
print("check database for items")
