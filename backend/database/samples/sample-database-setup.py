# SETUP INSTRUCTIONS
# 1. Copy .env.example to .env in the project root:
#       cp .env.example .env
# 2. Replace the placeholder values in .env with the actual Supabase credentials
# 3. Install dependencies: pip install -r backend/requirements.txt
# 4. Run from the database folder: cd backend/database && python sample-database-setup.py
#
# NOTES
# - Replace names and emails below when testing to avoid duplicates
# - Verify the changes in your Supabase dashboard after running


import os

from dotenv import load_dotenv
from supabase import create_client

# KINDLY READ THE COMMENTS ABOVE
load_dotenv("../../.env")

supabase = create_client(
    os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
)

# STEP 1: CREATE ACCOUNTS: This simulates a user registering their account
supervisor_auth = supabase.auth.admin.create_user(
    {"email": "supervisor@example.com", "password": "securepassword", "email_confirm": True}
)

agent_auth = supabase.auth.admin.create_user(
    {"email": "agent@example.com", "password": "securepassword", "email_confirm": True}
)

# STEP 2: ADD USER AND SUPERVISOR TO DATABASE:
# Supabase generates an ID from step one above so we use that as the user id,
#   that would help us with authentication.
supervisor = (
    supabase.table("users")
    .insert(
        {
            "id": supervisor_auth.user.id,
            "email": "supervisor@example.com",
            "first_name": "Jane",
            "last_name": "Doe",
            "role": "supervisor",
        }
    )
    .execute()
    .data[0]
)

agent = (
    supabase.table("users")
    .insert(
        {
            "id": agent_auth.user.id,
            "email": "agent@example.com",
            "first_name": "John",
            "last_name": "Smith",
            "role": "agent",
        }
    )
    .execute()
    .data[0]
)

# STEP 3: Create Team and Assign Supervisor
team = (
    supabase.table("teams")
    .insert({"name": "Support Team A", "supervisor_id": supervisor["id"]})
    .execute()
    .data[0]
)

# STEP 4: Add Supervisor and Agent to Team
supabase.table("users").update({"team_id": team["id"]}).eq("id", supervisor["id"]).execute()

supabase.table("users").update({"team_id": team["id"]}).eq("id", agent["id"]).execute()

print("Done")
