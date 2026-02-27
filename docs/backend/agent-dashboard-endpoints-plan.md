# Agent Dashboard Metrics Endpoints — Design Plan

## 1. Purpose

Expose REST endpoints that power the **Agent** side of the dashboard — personal performance metrics, post-call coaching tips, exemplar call library, and notifications. These replace the current frontend behavior where agent pages import `mockData` / `MockService` and compute everything client-side.

**Who consumes this:** The frontend agent pages (`Home.tsx`, `Performance.tsx`, `Exemplars.tsx`, `Notifications.tsx`) and potentially Postman/curl for verification.

---

## 2. Endpoints Overview

| #   | Method  | Path                                 | Purpose                                           | Frontend Page       |
| --- | ------- | ------------------------------------ | ------------------------------------------------- | ------------------- |
| 1   | `GET`   | `/api/agent/performance`             | Personal KPIs, weekly trend, team comparison      | `Performance.tsx`   |
| 2   | `GET`   | `/api/agent/coaching-tips`           | List of coaching tips for the authenticated agent | `Home.tsx`          |
| 3   | `PATCH` | `/api/agent/coaching-tips/{tip_id}`  | Update tip (helpful, bookmarked, dismissed)       | `Home.tsx`          |
| 4   | `GET`   | `/api/agent/exemplars`               | High-performing call library (list)               | `Exemplars.tsx`     |
| 5   | `GET`   | `/api/agent/exemplars/{exemplar_id}` | Full detail for one exemplar call                 | `Exemplars.tsx`     |
| 6   | `GET`   | `/api/agent/notifications`           | Unified notification inbox                        | `Notifications.tsx` |
| 7   | `PATCH` | `/api/agent/notifications/read-all`  | Mark all notifications as read                    | `Notifications.tsx` |

> **Auth note:** All endpoints require the authenticated user to have `role = 'agent'`. The `agent_id` is derived from the auth token — agents should **never** pass their own ID as a query param (prevents accessing other agents' data).

---

## 3. Endpoint 1 — Agent Performance

### Specification

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **Method**       | `GET`                                                    |
| **Path**         | `/api/agent/performance`                                 |
| **Auth**         | Agent role required                                      |
| **Query Params** | None (always last 7 days, matching the current frontend) |
| **Success**      | `200 OK`                                                 |
| **Empty**        | `200 OK` with zeroed values                              |

### Response Contract

```jsonc
{
  // ── KPI Cards ───────────────────────────────────────────
  // Maps to the 3 stat cards at the top of Performance.tsx

  "total_calls": 18, // int: agent's calls in last 7 days
  "avg_sentiment": 0.34, // float: mean sentiment for this agent
  "percentile": 72, // int: what % of teammates this agent outperforms

  // ── Weekly Trend (line + bar charts) ────────────────────
  // Maps to the two side-by-side charts in Performance.tsx
  // Always 7 entries, one per day, ordered Mon→Sun

  "weekly_trend": [
    {
      "day": "Mon", // short weekday label
      "sentiment": 0.45, // float: avg sentiment that day
      "calls": 4, // int: call count that day
    },
    // ... 7 entries
  ],

  // ── Team Comparison (progress bars) ─────────────────────
  // Maps to the "Team Comparison" card at the bottom of Performance.tsx
  // Anonymized percentile breakpoints — no other agent's data exposed

  "team_comparison": {
    "agent_avg": 0.34, // float: this agent's avg sentiment (same as above)
    "p25": -0.15, // float: team 25th percentile
    "p50": 0.2, // float: team 50th percentile (median)
    "p75": 0.45, // float: team 75th percentile
  },
}
```

### Database Tables

| Table           | Role                                                    |
| --------------- | ------------------------------------------------------- |
| `calls`         | Filter by `agent_id` and `started_at >= now() - 7 days` |
| `call_analyses` | Join for `sentiment_score`, `sentiment_label`           |
| `users`         | Get the agent's `team_id` to compute team percentiles   |

### Privacy Note

The `team_comparison` section returns **anonymized percentile values** computed across all agents on the same team. Individual teammate data is never exposed.

### Pseudocode

```python
# services/agent.py

async def get_agent_performance(supabase, agent_id: str) -> AgentPerformanceResponse:
    """
    Compute personal performance metrics for a single agent.
    """

    cutoff = datetime.utcnow() - timedelta(days=7)

    # ── Step 1: Fetch this agent's calls with analyses ────────────
    #
    # SQL:
    #   SELECT c.started_at, c.duration_seconds,
    #          ca.sentiment_score, ca.sentiment_label
    #   FROM calls c
    #   JOIN call_analyses ca ON ca.call_id = c.id
    #   WHERE c.agent_id = :agent_id
    #     AND c.started_at >= :cutoff

    agent_calls = []  # fetched rows

    # ── Step 2: Handle empty dataset ──────────────────────────────

    if not agent_calls:
        return AgentPerformanceResponse(
            total_calls=0,
            avg_sentiment=0.0,
            percentile=0,
            weekly_trend=[],
            team_comparison=TeamComparison(agent_avg=0.0, p25=0.0, p50=0.0, p75=0.0),
        )

    # ── Step 3: KPIs ──────────────────────────────────────────────

    total_calls = len(agent_calls)
    avg_sentiment = mean(c["sentiment_score"] for c in agent_calls)

    # ── Step 4: Weekly trend ──────────────────────────────────────
    #
    # Group agent_calls by day, compute daily avg sentiment + count

    weekly_trend = []  # 7 DayTrend entries

    # ── Step 5: Team comparison (anonymized) ──────────────────────
    #
    # Get all agents on the same team, compute each agent's avg sentiment,
    # then derive percentiles.
    #
    # SQL:
    #   SELECT c.agent_id, AVG(ca.sentiment_score) as avg_sent
    #   FROM calls c
    #   JOIN call_analyses ca ON ca.call_id = c.id
    #   WHERE c.team_id = :team_id
    #     AND c.started_at >= :cutoff
    #   GROUP BY c.agent_id
    #
    # Then compute numpy-style percentiles [25, 50, 75] from the list of avg_sent values.
    # The agent's own position in this distribution gives the `percentile` value.

    team_comparison = TeamComparison(agent_avg=avg_sentiment, p25=..., p50=..., p75=...)
    percentile = ...  # position of avg_sentiment within the team distribution

    return AgentPerformanceResponse(
        total_calls=total_calls,
        avg_sentiment=round(avg_sentiment, 2),
        percentile=round(percentile),
        weekly_trend=weekly_trend,
        team_comparison=team_comparison,
    )
```

---

## 4. Endpoint 2 & 3 — Coaching Tips

### 4a. GET — List Tips

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Method**       | `GET`                                                                  |
| **Path**         | `/api/agent/coaching-tips`                                             |
| **Auth**         | Agent role required                                                    |
| **Query Params** | `dismissed` — boolean, optional, default `false` (hide dismissed tips) |
| **Success**      | `200 OK`                                                               |

### Response Contract

```jsonc
{
  "tips": [
    {
      "id": "uuid",
      "call_id": "uuid", // source call (for "Why this tip?" context)
      "created_at": "2026-02-27T10:00:00Z",
      "content": [
        // array of tip strings (1-3 tips per entry)
        "Try acknowledging the customer's frustration earlier in the call",
        "Ensure clear next steps are communicated before ending the call",
      ],
      "reason": "Based on: negative sentiment detected, call not resolved",
      "helpful": null, // null | true | false — agent's feedback
      "bookmarked": false,
      "dismissed": false,
    },
    // ... ordered by created_at DESC
  ],
}
```

### 4b. PATCH — Update Tip

| Field         | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| **Method**    | `PATCH`                                                       |
| **Path**      | `/api/agent/coaching-tips/{tip_id}`                           |
| **Auth**      | Agent role required (must own the tip)                        |
| **Body**      | JSON with any subset of: `helpful`, `bookmarked`, `dismissed` |
| **Success**   | `200 OK` — updated tip object                                 |
| **Not Found** | `404` — tip doesn't exist or doesn't belong to this agent     |

**Request body example:**

```json
{ "helpful": true, "bookmarked": true }
```

### Database Tables

| Table           | Role                                                                  |
| --------------- | --------------------------------------------------------------------- |
| `coaching_tips` | Primary source — `agent_id`, `content`, `based_on_call_id`, `is_read` |

> **Schema note:** The current `coaching_tips` table has a single `content` TEXT field and `is_read` BOOLEAN. To support the full tip interaction model (helpful/bookmarked/dismissed + multi-tip content), we may need to either:
>
> - Add columns: `helpful` (BOOLEAN nullable), `bookmarked` (BOOLEAN), `dismissed` (BOOLEAN), and change `content` to JSONB (array of strings)
> - Or create a separate `coaching_tip_feedback` table
>
> This is an **open question** for the team to decide.

### Pseudocode

```python
# api/routers/agent.py

@router.get("/coaching-tips")
async def list_coaching_tips(
    dismissed: bool = Query(default=False),
    agent_id: str = Depends(get_current_agent_id),       # from auth token
    supabase=Depends(get_supabase),
):
    """
    List coaching tips for the authenticated agent.
    By default, dismissed tips are hidden.
    """
    # SQL:
    #   SELECT * FROM coaching_tips
    #   WHERE agent_id = :agent_id
    #     AND (dismissed = :dismissed OR :dismissed IS TRUE)
    #   ORDER BY created_at DESC

    return await get_coaching_tips(supabase, agent_id, dismissed)


@router.patch("/coaching-tips/{tip_id}")
async def update_coaching_tip(
    tip_id: str,
    body: CoachingTipUpdate,                              # Pydantic model: helpful?, bookmarked?, dismissed?
    agent_id: str = Depends(get_current_agent_id),
    supabase=Depends(get_supabase),
):
    """
    Update feedback on a coaching tip (helpful, bookmark, dismiss).
    Agent can only update their own tips.
    """
    # SQL:
    #   UPDATE coaching_tips
    #   SET helpful = :helpful, bookmarked = :bookmarked, dismissed = :dismissed
    #   WHERE id = :tip_id AND agent_id = :agent_id

    return await update_tip(supabase, tip_id, agent_id, body)
```

---

## 5. Endpoint 4 — Exemplar Calls

### Specification

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| **Method**       | `GET`                                            |
| **Path**         | `/api/agent/exemplars`                           |
| **Auth**         | Agent role required                              |
| **Query Params** | `topic` — string, optional. Filter by topic name |
| **Success**      | `200 OK`                                         |

### Response Contract

```jsonc
{
  "exemplars": [
    {
      "id": "uuid", // exemplar_calls.id
      "call_id": "uuid",
      "agent_name": "Jane Doe", // agent who took the exemplary call
      "duration_seconds": 420,
      "sentiment_score": 0.85,
      "sentiment_label": "positive",
      "topics": ["billing", "upsell"],
      "note": "Great empathy and resolution", // supervisor's note on why it's exemplary
      "created_at": "2026-02-20T14:00:00Z",
    },
    // ... ordered by created_at DESC
  ],
}
```

### Database Tables

| Table                             | Role                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `exemplar_calls`                  | Primary source — `call_id`, `team_id`, `marked_by`, `note` |
| `calls`                           | Join for `duration_seconds`, `agent_id`                    |
| `call_analyses`                   | Join for `sentiment_score`, `sentiment_label`              |
| `call_analysis_topics` + `topics` | Join for topic names                                       |
| `users`                           | Agent `first_name` + `last_name` for display               |

### Visibility Rule

Agents only see exemplars from their own team (`exemplar_calls.team_id` matches the agent's `team_id`).

### Pseudocode

```python
# services/agent.py

async def get_exemplars(supabase, agent_team_id: str, topic: str | None) -> ExemplarsResponse:
    """
    Fetch exemplar calls visible to the agent's team.
    """

    # SQL:
    #   SELECT ec.id, ec.call_id, ec.note, ec.created_at,
    #          c.duration_seconds,
    #          ca.sentiment_score, ca.sentiment_label,
    #          u.first_name || ' ' || u.last_name as agent_name,
    #          array_agg(t.name) as topics
    #   FROM exemplar_calls ec
    #   JOIN calls c            ON c.id = ec.call_id
    #   JOIN call_analyses ca   ON ca.call_id = c.id
    #   JOIN users u            ON u.id = c.agent_id
    #   LEFT JOIN call_analysis_topics cat ON cat.call_analysis_id = ca.id
    #   LEFT JOIN topics t      ON t.id = cat.topic_id
    #   WHERE ec.team_id = :agent_team_id
    #   GROUP BY ec.id, c.id, ca.id, u.id
    #   ORDER BY ec.created_at DESC
    #
    # If topic filter is provided, add:
    #   HAVING :topic = ANY(array_agg(t.name))

    return ExemplarsResponse(exemplars=...)
```

---

## 6. Endpoint 5 — Exemplar Call Detail

### Specification

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| **Method**       | `GET`                                                                      |
| **Path**         | `/api/agent/exemplars/{exemplar_id}`                                       |
| **Auth**         | Agent role required (must be on the same team as the exemplar's `team_id`) |
| **Query Params** | None                                                                       |
| **Success**      | `200 OK`                                                                   |
| **Not Found**    | `404` — exemplar doesn't exist or agent isn't on the same team             |

### Why a separate endpoint?

The list endpoint (`GET /api/agent/exemplars`) returns lightweight data for cards. This detail endpoint adds **transcript** and **AI-generated key moves** — both can be large. Fetching them for every exemplar in the list would waste bandwidth and slow down the initial page load.

### Response Contract

```jsonc
{
  // ── Everything from the list response ───────────────────

  "id": "uuid",
  "call_id": "uuid",
  "agent_name": "Christopher Lee",
  "duration_seconds": 310,
  "sentiment_score": 0.85,
  "sentiment_label": "positive",
  "topics": ["account-setup"],
  "note": "Great empathy and resolution",
  "created_at": "2026-02-20T14:00:00Z",

  // ── Detail-only fields ─────────────────────────────────

  "key_moves": [
    // AI-generated: what the agent did well
    "Acknowledged customer frustration early",
    "Offered clear next steps",
    "Confirmed resolution before ending",
  ],

  "transcript": [
    // Full conversation, ordered chronologically
    {
      "speaker": "customer",
      "text": "Hi, I need help setting up my new account.",
    },
    {
      "speaker": "agent",
      "text": "I'd be happy to help you with that! Let's get you set up right away.",
    },
    {
      "speaker": "customer",
      "text": "Great, thank you. What information do you need from me?",
    },
    {
      "speaker": "agent",
      "text": "Just your email address and a preferred username. Then I'll walk you through the rest.",
    },
    {
      "speaker": "customer",
      "text": "Perfect, that was so easy. Thank you for your help!",
    },
  ],

  "audio_url": null, // null for now — future: S3 presigned URL for recording playback
}
```

### Database Tables

| Table                             | Role                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `exemplar_calls`                  | Primary source — `call_id`, `team_id`, `note`                            |
| `calls`                           | Join for `duration_seconds`, `agent_id`, `recording_url`                 |
| `call_analyses`                   | Join for `sentiment_score`, `sentiment_label`, `transcript`, `key_moves` |
| `call_analysis_topics` + `topics` | Join for topic names                                                     |
| `users`                           | Agent `first_name` + `last_name` for display                             |

### Where `key_moves` comes from

`key_moves` is **AI-generated** and stored on the `call_analyses` table as a new JSONB column. When a call is analyzed (transcript processing), the AI produces:

- `summary` (already exists)
- `sentiment_score` / `sentiment_label` (already exist)
- `key_moves` (new) — array of 2-5 strings describing positive agent behaviors

This means `key_moves` exists for **every** analyzed call, not just exemplars. When a supervisor marks a call as exemplary, the `key_moves` are already there — no extra AI call needed.

### Pseudocode

```python
# services/agent.py

async def get_exemplar_detail(supabase, exemplar_id: str, agent_team_id: str) -> ExemplarDetailResponse:
    """
    Fetch full detail for a single exemplar call,
    including transcript and AI-generated key moves.
    """

    # SQL:
    #   SELECT ec.id, ec.call_id, ec.note, ec.created_at,
    #          c.duration_seconds, c.recording_url,
    #          ca.sentiment_score, ca.sentiment_label,
    #          ca.transcript, ca.key_moves,
    #          u.first_name || ' ' || u.last_name as agent_name,
    #          array_agg(t.name) as topics
    #   FROM exemplar_calls ec
    #   JOIN calls c            ON c.id = ec.call_id
    #   JOIN call_analyses ca   ON ca.call_id = c.id
    #   JOIN users u            ON u.id = c.agent_id
    #   LEFT JOIN call_analysis_topics cat ON cat.call_analysis_id = ca.id
    #   LEFT JOIN topics t      ON t.id = cat.topic_id
    #   WHERE ec.id = :exemplar_id
    #     AND ec.team_id = :agent_team_id     -- team visibility check
    #   GROUP BY ec.id, c.id, ca.id, u.id
    #
    # If no row returned → raise 404

    # Parse transcript from TEXT/JSONB into list of {speaker, text} objects
    # Parse key_moves from JSONB into list of strings
    # Build audio_url from c.recording_url (S3 presigned URL) or null

    return ExemplarDetailResponse(...)
```

```python
# api/routers/agent.py

@router.get("/exemplars/{exemplar_id}", response_model=ExemplarDetailResponse)
async def exemplar_detail(
    exemplar_id: str,
    agent_id: str = Depends(get_current_agent_id),
    supabase=Depends(get_supabase),
):
    """
    Get full detail for a single exemplar call.
    Agent must be on the same team as the exemplar.
    """
    agent_team_id = await get_agent_team_id(supabase, agent_id)
    result = await get_exemplar_detail(supabase, exemplar_id, agent_team_id)
    if not result:
        raise HTTPException(status_code=404, detail="Exemplar not found")
    return result
```

---

## 7. Endpoint 6 & 7 — Notifications

### 6a. GET — List Notifications

| Field            | Value                      |
| ---------------- | -------------------------- |
| **Method**       | `GET`                      |
| **Path**         | `/api/agent/notifications` |
| **Auth**         | Agent role required        |
| **Query Params** | None                       |
| **Success**      | `200 OK`                   |

### Response Contract

```jsonc
{
  "notifications": [
    {
      "id": "uuid",
      "type": "coaching_tip", // "alert" | "coaching_tip" | "exemplar_added"
      "title": "New coaching tips available",
      "body": "New coaching tips available for your recent call",
      "reference_type": "coaching_tip", // for frontend navigation
      "reference_id": "uuid", // ID of the referenced entity
      "is_read": false,
      "created_at": "2026-02-27T10:00:00Z",
    },
    // ... ordered by created_at DESC
  ],
  "unread_count": 3, // useful for badge display
}
```

### 6b. PATCH — Mark All Read

| Field       | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| **Method**  | `PATCH`                                                           |
| **Path**    | `/api/agent/notifications/read-all`                               |
| **Auth**    | Agent role required                                               |
| **Body**    | None                                                              |
| **Success** | `200 OK` — `{ "marked": 5 }` (count of notifications marked read) |

### Database Tables

| Table           | Role                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `notifications` | Primary source — `user_id`, `type`, `title`, `body`, `reference_type`, `reference_id`, `is_read` |

### Pseudocode

```python
# api/routers/agent.py

@router.get("/notifications")
async def list_notifications(
    agent_id: str = Depends(get_current_agent_id),
    supabase=Depends(get_supabase),
):
    """
    List all notifications for the authenticated agent, newest first.
    """
    # SQL:
    #   SELECT * FROM notifications
    #   WHERE user_id = :agent_id
    #   ORDER BY created_at DESC

    # Also compute:
    #   unread_count = COUNT(*) WHERE is_read = false

    return await get_notifications(supabase, agent_id)


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(
    agent_id: str = Depends(get_current_agent_id),
    supabase=Depends(get_supabase),
):
    """
    Mark all of this agent's notifications as read.
    """
    # SQL:
    #   UPDATE notifications
    #   SET is_read = true, updated_at = now()
    #   WHERE user_id = :agent_id AND is_read = false

    return await mark_all_read(supabase, agent_id)
```

---

## 7. Backend File Structure

All agent endpoints live under a unified router and service:

```
backend/
  api/
    routers/
      agent.py              # All 7 routes: performance, tips (GET/PATCH),
                             #   exemplars (list/detail), notifications (GET/PATCH)
    schemas/
      agent.py              # Pydantic models for all agent responses
  services/
    agent.py                # Business logic for all agent queries
```

Register in `api/main.py`:

```python
from api.routers import agent
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
```

---

## 8. Pydantic Models Summary (`api/schemas/agent.py`)

```python
from pydantic import BaseModel

# ── Performance ───────────────────────────────────────────

class DayTrend(BaseModel):
    day: str                       # "Mon", "Tue", etc.
    sentiment: float
    calls: int

class TeamComparison(BaseModel):
    agent_avg: float
    p25: float
    p50: float
    p75: float

class AgentPerformanceResponse(BaseModel):
    total_calls: int
    avg_sentiment: float
    percentile: int
    weekly_trend: list[DayTrend]
    team_comparison: TeamComparison

# ── Coaching Tips ─────────────────────────────────────────

class CoachingTip(BaseModel):
    id: str
    call_id: str
    created_at: str
    content: list[str]             # 1-3 tip strings
    reason: str
    helpful: bool | None           # null = no feedback yet
    bookmarked: bool
    dismissed: bool

class CoachingTipUpdate(BaseModel):
    helpful: bool | None = None
    bookmarked: bool | None = None
    dismissed: bool | None = None

class CoachingTipsResponse(BaseModel):
    tips: list[CoachingTip]

# ── Exemplars ─────────────────────────────────────────────

class Exemplar(BaseModel):
    id: str
    call_id: str
    agent_name: str
    duration_seconds: int
    sentiment_score: float
    sentiment_label: str
    topics: list[str]
    note: str
    created_at: str

class ExemplarsResponse(BaseModel):
    exemplars: list[Exemplar]

# ── Exemplar Detail ───────────────────────────────────────

class TranscriptLine(BaseModel):
    speaker: str                   # "customer" | "agent"
    text: str

class ExemplarDetailResponse(BaseModel):
    id: str
    call_id: str
    agent_name: str
    duration_seconds: int
    sentiment_score: float
    sentiment_label: str
    topics: list[str]
    note: str
    created_at: str
    key_moves: list[str]           # AI-generated, 2-5 strings
    transcript: list[TranscriptLine]
    audio_url: str | None          # null for now, future S3 presigned URL

# ── Notifications ─────────────────────────────────────────

class Notification(BaseModel):
    id: str
    type: str                      # "alert" | "coaching_tip" | "exemplar_added"
    title: str
    body: str
    reference_type: str
    reference_id: str
    is_read: bool
    created_at: str

class NotificationsResponse(BaseModel):
    notifications: list[Notification]
    unread_count: int

class MarkReadResponse(BaseModel):
    marked: int                    # count of notifications marked as read
```

---

## 9. Empty Dataset Responses

**Performance (no calls):**

```json
{
  "total_calls": 0,
  "avg_sentiment": 0.0,
  "percentile": 0,
  "weekly_trend": [],
  "team_comparison": { "agent_avg": 0.0, "p25": 0.0, "p50": 0.0, "p75": 0.0 }
}
```

**Coaching tips (none):**

```json
{ "tips": [] }
```

**Exemplars list (none):**

```json
{ "exemplars": [] }
```

**Exemplar detail (not found):**

```
404 Not Found
{ "detail": "Exemplar not found" }
```

**Notifications (none):**

```json
{ "notifications": [], "unread_count": 0 }
```

---

## 10. Verification Plan

| Step                   | How                                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| **Unit tests**         | Test each service function with mocked Supabase responses              |
| **Manual test**        | `curl` each endpoint and verify JSON shape                             |
| **Auth boundary test** | Verify agent A cannot see agent B's tips/performance                   |
| **Empty state test**   | Verify all endpoints return valid zeroed responses when no data exists |
| **Frontend test**      | Replace `MockService` calls with `fetch()` to these endpoints          |
| **Exemplar detail**    | Click an exemplar card → verify transcript, key_moves, audio_url load  |
