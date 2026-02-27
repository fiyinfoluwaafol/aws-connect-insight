# Supervisor Dashboard Metrics Endpoint — Design Plan

## 1. Purpose

Expose a single REST endpoint that returns all the aggregated metrics the **Supervisor Overview** page needs. This replaces the current frontend behavior where `Overview.tsx` imports `mockData` and computes everything client-side.

**Who consumes this:** The frontend `SupervisorOverview` component (and potentially Postman/curl for verification).

---

## 2. Endpoint Specification

| Field | Value |
|-------|-------|
| **Method** | `GET` |
| **Path** | `/api/dashboard/metrics` |
| **Auth** | Supervisor role required (to be implemented later) |
| **Query Params** | `days` — integer, optional, default `14`. Accepted values: `7`, `14`, `30` |
| **Success Response** | `200 OK` — JSON body (see §3) |
| **Empty Dataset** | `200 OK` — JSON body with zeroed values (see §5) |
| **Error Responses** | `422` — invalid `days` value · `401/403` — unauthorized (future) |

**Example request:**
```
GET /api/dashboard/metrics?days=14
```

---

## 3. Response Contract

This is the exact JSON shape the frontend should expect. Each field maps to something `Overview.tsx` currently computes from mock data.

```jsonc
{
  // ── KPI Stat Cards ──────────────────────────────────────
  // Maps to the 4 StatCard components at the top of Overview.tsx

  "avg_sentiment": 0.42,           // float: mean of call_analyses.sentiment_score
  "total_calls": 187,              // int:   count of calls in the date range
  "negative_call_percent": 22.3,   // float: % of calls where sentiment_label = 'negative'
  "open_alerts": 5,                // int:   count of alerts where is_read = false

  // ── Sentiment Trend (line/area chart) ───────────────────
  // Maps to the "Trends" tab → AreaChart in Overview.tsx
  // One entry per day within the date range, ordered chronologically

  "daily_metrics": [
    {
      "date": "2026-02-13",        // ISO date string
      "avg_sentiment": 0.35,       // float: daily mean sentiment
      "call_count": 14,            // int:   calls that day
      "avg_duration": 312,         // int:   mean duration_seconds
      "negative_percent": 28.6     // float: % negative that day
    }
    // ... one per day
  ],

  // ── Topic Distribution (bar chart) ──────────────────────
  // Maps to the "Topics" tab → BarChart in Overview.tsx
  // Top 8 topics by occurrence count, descending

  "top_topics": [
    { "name": "billing", "count": 42 },
    { "name": "refund",  "count": 31 }
    // ... up to 8
  ],

  // ── Sentiment Distribution (pie chart) ──────────────────
  // Maps to the PieChart showing positive/neutral/negative split

  "sentiment_distribution": {
    "positive": 98,                // int: count of 'positive' calls
    "neutral":  52,                // int: count of 'neutral'  calls
    "negative": 37                 // int: count of 'negative' calls
  },

  // ── Agent Performance (bar chart) ───────────────────────
  // Maps to the "Agents" tab → BarChart in Overview.tsx
  // Top 6 agents by avg sentiment, descending

  "agent_stats": [
    {
      "agent_id": "uuid-here",
      "name": "Jane",              // first name only (for chart label)
      "avg_sentiment": 0.71,       // float: mean sentiment for this agent
      "call_count": 28             // int:   calls handled by this agent
    }
    // ... up to 6
  ]
}
```

---

## 4. Database Tables Involved

| Table | Role in this endpoint |
|-------|----------------------|
| `calls` | Source of `started_at`, `duration_seconds`, `agent_id`, `team_id`. Filtered by date range. |
| `call_analyses` | Joined 1:1 to `calls` via `call_id`. Provides `sentiment_score`, `sentiment_label`, `is_resolved`. |
| `call_analysis_topics` | Join table linking analyses → topics. Used for topic distribution. |
| `topics` | Provides topic `name` for chart labels. |
| `alerts` | Queried for `is_read = false` count (open alerts). Filtered by `team_id`. |
| `users` | Agent `first_name` for the agent stats chart. Filtered by `role = 'agent'`. |

### Key joins

```
calls ──(1:1)──► call_analyses        (via call_analyses.call_id = calls.id)
call_analyses ──(M:N)──► topics       (via call_analysis_topics junction table)
calls ──(M:1)──► users                (via calls.agent_id = users.id)
alerts ──(M:1)──► teams               (via alerts.team_id)
```

---

## 5. Pseudocode

### 5.1 Backend file structure (new files to create)

```
backend/
  api/
    routers/
      dashboard.py        # Route definition — GET /api/dashboard/metrics
    schemas/
      __init__.py
      dashboard.py         # Pydantic response models
  services/
    dashboard.py           # Business logic — SQL aggregation
```

### 5.2 Pydantic Response Models (`api/schemas/dashboard.py`)

```python
# These models define the exact JSON contract from §3.
# FastAPI auto-generates OpenAPI docs from these.

from pydantic import BaseModel

class DailyMetric(BaseModel):
    date: str                  # "2026-02-13"
    avg_sentiment: float
    call_count: int
    avg_duration: int          # seconds
    negative_percent: float

class TopicCount(BaseModel):
    name: str
    count: int

class SentimentDistribution(BaseModel):
    positive: int
    neutral: int
    negative: int

class AgentStat(BaseModel):
    agent_id: str              # UUID as string
    name: str                  # first name
    avg_sentiment: float
    call_count: int

class DashboardMetricsResponse(BaseModel):
    # KPI cards
    avg_sentiment: float
    total_calls: int
    negative_call_percent: float
    open_alerts: int

    # Chart data
    daily_metrics: list[DailyMetric]
    top_topics: list[TopicCount]
    sentiment_distribution: SentimentDistribution
    agent_stats: list[AgentStat]
```

### 5.3 Router (`api/routers/dashboard.py`)

```python
# This file defines the route and validates the query parameter.
# It delegates all logic to the service layer.
# It will be registered in main.py with:
#     app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])

from fastapi import APIRouter, Query, Depends
from api.schemas.dashboard import DashboardMetricsResponse
from services.dashboard import get_dashboard_metrics
from api.dependencies import get_supabase   # existing DI for Supabase client

router = APIRouter()

@router.get("/metrics", response_model=DashboardMetricsResponse)
async def dashboard_metrics(
    days: int = Query(default=14, ge=7, le=30),       # validate: 7 ≤ days ≤ 30
    supabase=Depends(get_supabase),                    # injected Supabase client
):
    """
    Return aggregated dashboard metrics for the supervisor overview page.
    Accepts `days` query param to control the lookback window (7, 14, or 30).
    """
    # All aggregation happens in the service layer
    return await get_dashboard_metrics(supabase, days)
```

### 5.4 Service Layer (`services/dashboard.py`)

```python
# This is where the actual data aggregation logic lives.
# Each section below corresponds to a piece of the response contract.
# SQL queries are written as comments — actual implementation will use
# the Supabase Python client's .from_().select() syntax or raw SQL via .rpc().

from datetime import datetime, timedelta
from api.schemas.dashboard import (
    DashboardMetricsResponse,
    DailyMetric,
    TopicCount,
    SentimentDistribution,
    AgentStat,
)

async def get_dashboard_metrics(supabase, days: int) -> DashboardMetricsResponse:
    """
    Aggregate all metrics for the supervisor dashboard.

    Steps:
    1. Calculate the cutoff date (now - days)
    2. Query calls + call_analyses for the date range
    3. Compute KPIs, daily metrics, topic distribution, sentiment split, agent stats
    4. Return structured response
    """

    cutoff = datetime.utcnow() - timedelta(days=days)

    # ── Step 1: Fetch calls with their analyses in the date range ──────
    #
    # SQL equivalent:
    #   SELECT c.id, c.agent_id, c.duration_seconds, c.started_at,
    #          ca.sentiment_score, ca.sentiment_label, ca.is_resolved
    #   FROM calls c
    #   JOIN call_analyses ca ON ca.call_id = c.id
    #   WHERE c.started_at >= cutoff
    #
    # Supabase client pseudocode:
    #   result = supabase.from_("calls")
    #       .select("id, agent_id, duration_seconds, started_at, call_analyses(sentiment_score, sentiment_label, is_resolved)")
    #       .gte("started_at", cutoff.isoformat())
    #       .execute()

    calls = []  # fetched rows

    # ── Step 2: Handle empty dataset ───────────────────────────────────
    #
    # If no calls exist in the range, return zeroed-out response immediately.
    # This satisfies the acceptance criteria: "Handles empty dataset gracefully"

    if not calls:
        return DashboardMetricsResponse(
            avg_sentiment=0.0,
            total_calls=0,
            negative_call_percent=0.0,
            open_alerts=0,
            daily_metrics=[],
            top_topics=[],
            sentiment_distribution=SentimentDistribution(positive=0, neutral=0, negative=0),
            agent_stats=[],
        )

    # ── Step 3: KPI calculations ──────────────────────────────────────
    #
    # avg_sentiment      = mean of all sentiment_score values
    # total_calls        = len(calls)
    # negative_percent   = count(sentiment_label == 'negative') / total_calls * 100

    total_calls = len(calls)
    avg_sentiment = sum(c["sentiment_score"] for c in calls) / total_calls
    negative_count = sum(1 for c in calls if c["sentiment_label"] == "negative")
    negative_call_percent = (negative_count / total_calls) * 100

    # ── Step 4: Open alerts count ─────────────────────────────────────
    #
    # SQL equivalent:
    #   SELECT count(*) FROM alerts WHERE is_read = false
    #
    # Note: When auth is added, this will be filtered by the supervisor's team_id:
    #   ... AND team_id = <supervisor's team>

    open_alerts = 0  # count from query

    # ── Step 5: Daily metrics (for trend chart) ───────────────────────
    #
    # Group calls by date (c.started_at::date), compute per-day aggregates.
    #
    # SQL equivalent:
    #   SELECT DATE(c.started_at) as date,
    #          AVG(ca.sentiment_score) as avg_sentiment,
    #          COUNT(*) as call_count,
    #          AVG(c.duration_seconds) as avg_duration,
    #          (COUNT(*) FILTER (WHERE ca.sentiment_label = 'negative')::float
    #            / COUNT(*) * 100) as negative_percent
    #   FROM calls c
    #   JOIN call_analyses ca ON ca.call_id = c.id
    #   WHERE c.started_at >= cutoff
    #   GROUP BY DATE(c.started_at)
    #   ORDER BY date

    daily_metrics: list[DailyMetric] = []  # built from grouped query results

    # ── Step 6: Topic distribution (for bar chart) ────────────────────
    #
    # Count how often each topic appears across calls in the range.
    # Return top 8 by count.
    #
    # SQL equivalent:
    #   SELECT t.name, COUNT(*) as count
    #   FROM call_analysis_topics cat
    #   JOIN topics t            ON t.id = cat.topic_id
    #   JOIN call_analyses ca    ON ca.id = cat.call_analysis_id
    #   JOIN calls c             ON c.id = ca.call_id
    #   WHERE c.started_at >= cutoff
    #   GROUP BY t.name
    #   ORDER BY count DESC
    #   LIMIT 8

    top_topics: list[TopicCount] = []  # built from query

    # ── Step 7: Sentiment distribution (for pie chart) ────────────────
    #
    # Simply count calls per sentiment_label. Already have the data from Step 1.

    positive = sum(1 for c in calls if c["sentiment_label"] == "positive")
    neutral  = sum(1 for c in calls if c["sentiment_label"] == "neutral")
    negative = negative_count  # already computed above

    sentiment_distribution = SentimentDistribution(
        positive=positive, neutral=neutral, negative=negative
    )

    # ── Step 8: Agent performance stats (for bar chart) ───────────────
    #
    # Group by agent, compute avg sentiment + call count per agent.
    # Join to users table for agent first_name. Return top 6 by avg sentiment.
    #
    # SQL equivalent:
    #   SELECT u.id as agent_id,
    #          u.first_name as name,
    #          AVG(ca.sentiment_score) as avg_sentiment,
    #          COUNT(*) as call_count
    #   FROM calls c
    #   JOIN call_analyses ca ON ca.call_id = c.id
    #   JOIN users u          ON u.id = c.agent_id
    #   WHERE c.started_at >= cutoff
    #   GROUP BY u.id, u.first_name
    #   ORDER BY avg_sentiment DESC
    #   LIMIT 6

    agent_stats: list[AgentStat] = []  # built from query

    # ── Step 9: Assemble and return ───────────────────────────────────

    return DashboardMetricsResponse(
        avg_sentiment=round(avg_sentiment, 2),
        total_calls=total_calls,
        negative_call_percent=round(negative_call_percent, 1),
        open_alerts=open_alerts,
        daily_metrics=daily_metrics,
        top_topics=top_topics,
        sentiment_distribution=sentiment_distribution,
        agent_stats=agent_stats,
    )
```

### 5.5 Register the router (`api/main.py` — existing file)

```python
# Add this import alongside the existing health import:
from api.routers import dashboard

# Add this line alongside the existing health router registration:
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
```

---

## 6. Empty Dataset Response

When there are zero calls in the requested date range, the endpoint returns `200 OK` with:

```json
{
  "avg_sentiment": 0.0,
  "total_calls": 0,
  "negative_call_percent": 0.0,
  "open_alerts": 0,
  "daily_metrics": [],
  "top_topics": [],
  "sentiment_distribution": { "positive": 0, "neutral": 0, "negative": 0 },
  "agent_stats": []
}
```

The frontend should check `total_calls === 0` and show an appropriate empty state (e.g., "No calls in the last 14 days").

---

## 7. Verification Plan

| Step | How |
|------|-----|
| **Unit tests** | Test service function with mocked Supabase responses (empty dataset, normal dataset, edge cases) |
| **Manual test** | `curl http://localhost:8000/api/dashboard/metrics?days=14` and verify JSON shape |
| **Postman screenshot** | Capture response for acceptance criteria evidence |
| **Frontend test** | Swap mock data fetch for API call, verify Overview page renders correctly |

