#!/usr/bin/env python3
"""
Generate sample call data for specific agents.

Usage:
    python backend/database/samples/generate-sample-calls.py <agent_email> <num_calls> [agent_email2] [num_calls2] ...

Example:
    python backend/database/samples/generate-sample-calls.py agent1@example.com 20 agent2@example.com 15
"""

import os
import random
import sys
from datetime import datetime, timedelta
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

# Sample data templates
TOPICS = [
    "billing-issue",
    "technical-support",
    "account-access",
    "product-inquiry",
    "cancellation-request",
    "upgrade-request",
    "complaint",
    "general-inquiry"
]

SUMMARIES = {
    "positive": [
        "Customer was satisfied with the resolution provided. Issue resolved successfully.",
        "Great conversation! Customer appreciated the quick response and helpful guidance.",
        "Customer expressed gratitude for the assistance. All questions answered thoroughly.",
        "Smooth call with excellent rapport. Customer left happy with the solution.",
    ],
    "neutral": [
        "Customer inquiry handled. Some information provided, follow-up may be needed.",
        "Standard support call. Customer received requested information.",
        "Call completed. Customer's questions were addressed adequately.",
        "Routine inquiry. Customer was informed about next steps.",
    ],
    "negative": [
        "Customer was frustrated with long wait times and unresolved issue.",
        "Difficult conversation. Customer unhappy with current service limitations.",
        "Customer expressed dissatisfaction. Issue requires escalation.",
        "Challenging call. Customer remained upset despite attempted resolution.",
    ]
}


def generate_calls_for_agent(agent_email: str, num_calls: int):
    """Generate sample call data for a specific agent."""

    # Step 1: Get agent
    print(f"\nLooking up agent: {agent_email}")
    result = supabase.table("users").select("*").eq("email", agent_email).execute()

    if not result.data:
        print(f"❌ Error: No user found with email {agent_email}")
        return 0

    agent = result.data[0]
    team_id = agent.get("team_id")

    if not team_id:
        print(f"❌ Error: Agent is not assigned to a team")
        return 0

    print(f"✓ Found agent: {agent['first_name']} {agent['last_name']}")
    print(f"✓ Team ID: {team_id}")

    # Step 2: Generate calls for this agent
    today = datetime.now()
    print(f"Generating {num_calls} calls...")

    for i in range(num_calls):
        # Random date within last 14 days
        days_ago = random.randint(0, 13)
        call_time = today - timedelta(days=days_ago, hours=random.randint(0, 8), minutes=random.randint(0, 59))

        # Random duration between 2-20 minutes
        duration = random.randint(120, 1200)

        # Random sentiment (weighted towards neutral/positive)
        sentiment_type = random.choices(
            ["positive", "neutral", "negative"],
            weights=[0.4, 0.4, 0.2]
        )[0]

        if sentiment_type == "positive":
            sentiment_score = random.uniform(0.3, 1.0)
        elif sentiment_type == "neutral":
            sentiment_score = random.uniform(-0.29, 0.29)
        else:
            sentiment_score = random.uniform(-1.0, -0.3)

        # Create call
        call = supabase.table("calls").insert({
            "agent_id": agent["id"],
            "team_id": team_id,
            "recording_url": f"https://example.com/recordings/call-{random.randint(10000, 99999)}.mp3",
            "duration_seconds": duration,
            "started_at": call_time.isoformat(),
        }).execute().data[0]

        # Create call analysis
        summary = random.choice(SUMMARIES[sentiment_type])

        analysis = supabase.table("call_analyses").insert({
            "call_id": call["id"],
            "summary": summary,
            "sentiment_score": round(sentiment_score, 3),
            "sentiment_label": sentiment_type,
            "is_resolved": sentiment_type != "negative" or random.random() > 0.5,
        }).execute().data[0]

        # Add 1-3 random topics to the analysis
        num_topics = random.randint(1, 3)
        selected_topics = random.sample(TOPICS, num_topics)

        for topic_name in selected_topics:
            # Get or create topic
            topic_result = supabase.table("topics").upsert(
                {"name": topic_name},
                on_conflict="name"
            ).execute()
            topic = topic_result.data[0]

            # Link topic to analysis
            supabase.table("call_analysis_topics").upsert({
                "call_analysis_id": analysis["id"],
                "topic_id": topic["id"]
            }, on_conflict="call_analysis_id,topic_id").execute()

    print(f"✓ Generated {num_calls} calls for {agent['first_name']} {agent['last_name']}")
    return num_calls


if __name__ == "__main__":
    if len(sys.argv) < 3 or len(sys.argv) % 2 != 1:
        print("Usage: python generate-sample-calls.py <agent_email> <num_calls> [agent_email2] [num_calls2] ...")
        print("Example: python generate-sample-calls.py agent1@example.com 20 agent2@example.com 15")
        sys.exit(1)

    # Parse agent email and count pairs
    agents_to_generate = []
    for i in range(1, len(sys.argv), 2):
        agent_email = sys.argv[i]
        num_calls = int(sys.argv[i + 1])

        if num_calls < 1 or num_calls > 100:
            print(f"❌ Error: num_calls must be between 1 and 100 (got {num_calls} for {agent_email})")
            sys.exit(1)

        agents_to_generate.append((agent_email, num_calls))

    # Generate calls for each agent
    print(f"Generating calls for {len(agents_to_generate)} agent(s)...")
    total_calls = 0

    for agent_email, num_calls in agents_to_generate:
        calls_generated = generate_calls_for_agent(agent_email, num_calls)
        total_calls += calls_generated

    print(f"\n✅ Done! Generated {total_calls} total calls with analyses and topics.")
    print(f"Refresh your dashboard to see the data!")
