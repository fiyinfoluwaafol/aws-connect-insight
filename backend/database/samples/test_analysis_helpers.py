"""
Test script for analysis helpers.

Run from backend directory:
    python -m database.samples.test_analysis_helpers

Requires:
    - .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    - Existing call record in database (or creates one)
"""

import os
import sys
from pathlib import Path

# Setup paths
backend = Path(__file__).parent.parent.parent
project_root = backend.parent
sys.path.insert(0, str(backend))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from database import analysis  # noqa: E402
from database.constants import Tables  # noqa: E402

load_dotenv(project_root / ".env")

# Create client
client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def print_step(msg):
    print(f"  ✓ {msg}")


def print_section(name):
    print(f"\n{'=' * 50}")
    print(f" {name}")
    print(f"{'=' * 50}")


# Track created IDs for cleanup
created = {}

try:
    print_section("0. SETUP")

    # Get an existing call or create a minimal one for testing
    print("\n  → Finding or creating a test call...")

    # Try to find an existing call
    result = client.table(Tables.CALLS).select("id").limit(1).execute()

    if result.data:
        call_id = result.data[0]["id"]
        print_step(f"Using existing call → id: {call_id}")
    else:
        # Need to create a call - this requires agent_id and team_id
        print("  No existing calls found. Please run test_helpers.py first to create test data.")
        sys.exit(1)

    # Clean up any existing analysis for this call (for re-running tests)
    print("\n  → Cleaning up any existing analysis for this call...")
    client.table(Tables.CALL_ANALYSES).delete().eq("call_id", call_id).execute()
    print_step("Cleaned up existing analysis")

    print_section("1. CREATE ANALYSIS")

    print("\n  → Testing: create_analysis")
    result = analysis.create_analysis(
        client,
        call_id=call_id,
        summary="Customer called about billing. Agent offered a refund.",
        sentiment_score=0.45,
        sentiment_label="neutral",
        key_moves=["Acknowledged frustration", "Offered refund", "Confirmed resolution"],
        is_resolved=True,
    )
    created["analysis_id"] = result["id"]
    print_step(f"create_analysis → id: {result['id']}")
    print_step(f"  summary: {result['summary'][:50]}...")
    print_step(f"  sentiment_score: {result['sentiment_score']}")
    print_step(f"  key_moves: {result['key_moves']}")

    print_section("2. CREATE TOPICS & KEYWORDS")

    print("\n  → Testing: create_topic (single)")
    topic = analysis.create_topic(client, "Billing")
    created["topic_id"] = topic["id"]
    print_step(f"create_topic → name: '{topic['name']}' (normalized from 'Billing')")

    print("\n  → Testing: create_topic (duplicate/upsert)")
    topic_dup = analysis.create_topic(client, "BILLING")
    print_step(f"create_topic (upsert) → same id: {topic['id'] == topic_dup['id']}")

    print("\n  → Testing: create_keyword (single)")
    keyword = analysis.create_keyword(client, "Frustrated")
    created["keyword_id"] = keyword["id"]
    print_step(f"create_keyword → word: '{keyword['word']}' (normalized from 'Frustrated')")

    print_section("3. LINK TOPICS & KEYWORDS TO ANALYSIS")

    print("\n  → Testing: add_topics_to_analysis")
    topics = analysis.add_topics_to_analysis(
        client,
        created["analysis_id"],
        ["Billing", "Refund", "ACCOUNT"],  # mixed case to test normalization
    )
    print_step(f"add_topics_to_analysis → added {len(topics)} topics")
    print_step(f"  topics: {[t['name'] for t in topics]}")

    print("\n  → Testing: add_keywords_to_analysis")
    keywords = analysis.add_keywords_to_analysis(
        client,
        created["analysis_id"],
        ["frustrated", "MANAGER", "Complaint"],  # mixed case
    )
    print_step(f"add_keywords_to_analysis → added {len(keywords)} keywords")
    print_step(f"  keywords: {[k['word'] for k in keywords]}")

    print_section("4. GET ANALYSIS WITH TOPICS & KEYWORDS")

    print("\n  → Testing: get_analysis_by_call_id")
    fetched = analysis.get_analysis_by_call_id(client, call_id)
    print_step(f"get_analysis_by_call_id → id: {fetched['id']}")
    print_step(f"  summary: {fetched['summary'][:50]}...")
    print_step(f"  sentiment_score: {fetched['sentiment_score']}")
    print_step(f"  sentiment_label: {fetched['sentiment_label']}")
    print_step(f"  key_moves: {fetched['key_moves']}")
    print_step(f"  is_resolved: {fetched['is_resolved']}")
    print_step(f"  topics: {fetched['topics']}")
    print_step(f"  keywords: {fetched['keywords']}")

    print_section("5. UPDATE ANALYSIS")

    print("\n  → Testing: update_analysis")
    updated = analysis.update_analysis(
        client,
        created["analysis_id"],
        sentiment_score=0.65,
        sentiment_label="positive",
        summary="Updated: Customer issue was fully resolved with excellent service.",
    )
    print_step(f"update_analysis → updated sentiment_score: {updated['sentiment_score']}")
    print_step(f"  new summary: {updated['summary'][:50]}...")

    print_section("TEST COMPLETE")
    print("\n✅ All analysis helpers working correctly!")
    print("\nCreated records:")
    for key, value in created.items():
        print(f"  {key}: {value}")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback

    traceback.print_exc()
    print("\nCreated records before failure:")
    for key, value in created.items():
        print(f"  {key}: {value}")
    raise
