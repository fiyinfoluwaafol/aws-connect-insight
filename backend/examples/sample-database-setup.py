# STUFF TO REMEMBER
#   - Make sure to replace all names and emails to new values when testing to avoid duplicates. You could have an AI model do this for the most part.
#   - Make sure to install the modules in the requirements file.
#   - Add your env to the project root not this backend folder since load_dotenv calls from there and make sure to cd into the examples folder and run the code from there, 
#       otherwise you can use load_dotenv('.env') and run it using python3 backend/examples/sample-database-setup.py from the base folder instead.
#   - Also use the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as the env variable names since that's used here also.
#   - Test then check the changes in supabase.


import os
from dotenv import load_dotenv
from supabase import create_client

# KINDLY READ THE COMMENTS ABOVE
load_dotenv('../../.env')

supabase = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
)

# STEP 1: CREATE ACCOUNTS: This simulates a user registering their account
supervisor_auth = supabase.auth.admin.create_user({
    'email': 'supervisor@example.com',
    'password': 'securepassword',
    'email_confirm': True
})

agent_auth = supabase.auth.admin.create_user({
    'email': 'agent@example.com',
    'password': 'securepassword',
    'email_confirm': True
})

# STEP 2: ADD USER AND SUPERVISOR TO DATABASE: 
# Supabase generates an ID from step one above so we use that as the user id, 
#   that would help us with authentication.
supervisor = supabase.table('users').insert({
    'id': supervisor_auth.user.id,
    'email': 'supervisor@example.com',
    'first_name': 'Jane',
    'last_name': 'Doe',
    'role': 'supervisor'
}).execute().data[0]

agent = supabase.table('users').insert({
    'id': agent_auth.user.id,
    'email': 'agent@example.com',
    'first_name': 'John',
    'last_name': 'Smith',
    'role': 'agent'
}).execute().data[0]

# STEP 3: Create Team and Assign Supervisor 
team = supabase.table('teams').insert({
    'name': 'Support Team A',
    'supervisor_id': supervisor['id']
}).execute().data[0]

# STEP 4: Add Supervisor and Agent to Team
supabase.table('users').update({
    'team_id': team['id']
}).eq('id', supervisor['id']).execute()

supabase.table('users').update({
    'team_id': team['id']
}).eq('id', agent['id']).execute()

print("Done")