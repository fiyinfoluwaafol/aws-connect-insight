# Sitewide Backend API Plan — All Routes

## Overview

| Group                  | Endpoints | Serves                                     |
| ---------------------- | --------- | ------------------------------------------ |
| Auth                   | 8         | Both roles                                 |
| Supervisor — Dashboard | 1         | Overview page                              |
| Supervisor — Alerts    | 4         | Alerts page + alert detail sidebar         |
| Supervisor — Search    | 1         | Search page                                |
| Supervisor — Briefs    | 3         | Briefs page                                |
| Supervisor — Settings  | 2         | Settings page                              |
| Agent — Performance    | 1         | Performance page                           |
| Agent — Coaching Tips  | 2         | Home page                                  |
| Agent — Exemplars      | 2         | Exemplars page                             |
| Agent — Notifications  | 2         | Notifications page                         |
| Shared — Calls         | 1         | CallDetailDrawer (used by Alerts + Search) |
| Shared — Notes         | 2         | CallDetailDrawer (notes section)           |
| Shared — Actions       | 1         | CallDetailDrawer (Mark Exemplar)           |
| Shared — Agents        | 1         | Search page (agent filter dropdown)        |
| **Total**              | **31**    |                                            |

## AUTH

### POST `/api/auth/register`

Create a new user account. 

**Request Body:**

```json
{
  "email": "marcus@example.com",
  "first_name": "Marcus",
  "last_name": "Johnson",
  "password": "securePass123",
  "role": "agent",
  "team_id": "uuid"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "email": "marcus@example.com",
  "full_name": "Marcus Johnson",
  "role": "agent",
  "team_id": "uuid",
  "created_at": "2026-03-04T10:00:00Z"
}
```

**Errors:** `409` email already exists, `422` validation error

---

### POST `/api/auth/login`

Sign in with credentials.

**Request Body:**

```json
{
  "email": "sarah@example.com",
  "password": "password123"
}
```

**Response `200`:**

```json
{
  "user": {
    "id": "uuid",
    "email": "sarah@example.com",
    "full_name": "Sarah Chen",
    "role": "supervisor",
    "team_id": "uuid"
  },
  "access_token": "stub-jwt-token",
  "refresh_token": "stub-refresh-token",
  "expires_in": 3600
}
```

**Errors:** `401` invalid credentials

---

### POST `/api/auth/logout`

Sign out the current session.

**Request Body:** None

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{ "ok": true }
```

---

### GET `/api/auth/me`

Get the currently authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "id": "uuid",
  "email": "sarah@example.com",
  "full_name": "Sarah Chen",
  "role": "supervisor",
  "team_id": "uuid"
}
```

**Errors:** `401` no token or invalid token

---

### POST `/api/auth/refresh`

Refresh an expired access token using a refresh token.

**Request Body:**

```json
{
  "refresh_token": "stub-refresh-token"
}
```

**Response `200`:**

```json
{
  "access_token": "new-stub-jwt-token",
  "refresh_token": "new-stub-refresh-token",
  "expires_in": 3600
}
```

**Errors:** `401` invalid or expired refresh token

---

### POST `/api/auth/forgot-password`

Request a password reset email.

**Request Body:**

```json
{
  "email": "sarah@example.com"
}
```

**Response `200`:**

```json
{ "ok": true, "message": "If that email exists, a reset link has been sent." }
```

**Note:** Always returns `200` regardless of whether the email exists (prevents user enumeration).

---

### POST `/api/auth/reset-password`

Set a new password using a reset token from the email link.

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "new_password": "newSecurePass456"
}
```

**Response `200`:**

```json
{ "ok": true, "message": "Password has been reset." }
```

**Errors:** `401` invalid or expired reset token, `422` password too weak

---

### PATCH `/api/auth/change-password`

Change password while logged in.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "current_password": "oldPass123",
  "new_password": "newSecurePass456"
}
```

**Response `200`:**

```json
{ "ok": true, "message": "Password updated." }
```

**Errors:** `401` current password incorrect, `422` new password too weak

---

## SUPERVISOR — DASHBOARD

### GET `/api/dashboard/metrics`

Dashboard overview stats, charts, and agent performance.

**Query Params:**

| Param  | Type | Default | Description                      |
| ------ | ---- | ------- | -------------------------------- |
| `days` | int  | `14`    | Lookback window. Range: `7`–`30` |

**Response `200`:**

```json
{
  "avg_sentiment": 0.42,
  "total_calls": 187,
  "negative_call_percent": 22.3,
  "open_alerts": 5,
  "daily_metrics": [
    {
      "date": "2026-02-18",
      "avg_sentiment": 0.45,
      "call_count": 14,
      "avg_duration": 312,
      "negative_percent": 20.0
    }
  ],
  "top_topics": [
    { "name": "billing", "count": 42 },
    { "name": "refund", "count": 31 }
  ],
  "sentiment_distribution": {
    "positive": 95,
    "neutral": 58,
    "negative": 34
  },
  "agent_stats": [
    {
      "agent_id": "uuid",
      "first_name": "Sarah",
      "last_name": "Chen",
      "avg_sentiment": 0.71,
      "call_count": 28
    }
  ]
}
```

---

## SUPERVISOR — ALERTS

### GET `/api/alerts`

List alerts for the supervisor's team.

**Query Params:**

| Param      | Type   | Default | Description                     |
| ---------- | ------ | ------- | ------------------------------- |
| `severity` | string | —       | Filter: `low`, `medium`, `high` |
| `status`   | string | —       | Filter: `open`, `closed`        |
| `is_read`  | bool   | —       | Filter by read/unread           |
| `page`     | int    | `1`     | Pagination                      |
| `per_page` | int    | `20`    | Items per page                  |

**Response `200`:**

```json
{
  "alerts": [
    {
      "id": "uuid",
      "type": "negative_sentiment",
      "severity": "high",
      "status": "open",
      "title": "High negative sentiment detected",
      "description": "Agent Marcus Johnson had 3 consecutive negative calls",
      "agent_id": "uuid",
      "agent_name": "Marcus Johnson",
      "call_id": "uuid",
      "is_read": false,
      "created_at": "2026-02-28T14:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

---

### PATCH `/api/alerts/{alert_id}`

Update an alert's read state and/or status.

**Request Body** (all fields optional):

```json
{ "is_read": true, "status": "closed" }
```

**Response `200`:**

```json
{
  "id": "uuid",
  "is_read": true,
  "status": "closed"
}
```

---

### PATCH `/api/alerts/read-all`

Mark all alerts as read for the supervisor's team.

**Request Body:** None

**Response `200`:**

```json
{ "marked": 12 }
```

---

### POST `/api/alerts`

Manually create an alert from a call. Used when a supervisor reviews a call and wants to flag it.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "call_id": "uuid",
  "severity": "medium",
  "title": "Follow-up needed",
  "description": "Customer expressed frustration about delayed refund. Needs supervisor follow-up."
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "type": "manual",
  "severity": "medium",
  "status": "open",
  "title": "Follow-up needed",
  "description": "Customer expressed frustration about delayed refund. Needs supervisor follow-up.",
  "agent_id": "uuid",
  "agent_name": "Marcus Johnson",
  "call_id": "uuid",
  "is_read": false,
  "created_at": "2026-03-04T14:30:00Z"
}
```

**Errors:** `404` call not found, `422` missing required fields

**Note:** `agent_id` and `agent_name` are derived from the call — not provided in the request body. `type` is set to `"manual"` to distinguish from system-generated alerts.

---

## SHARED — AGENTS

### GET `/api/agents`

List agents on the supervisor's team. Used to populate the agent filter dropdown on the Search page.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "agents": [
    {
      "id": "uuid",
      "full_name": "Marcus Johnson"
    },
    {
      "id": "uuid",
      "full_name": "Lisa Park"
    }
  ]
}
```

---

## SUPERVISOR — SEARCH

### GET `/api/calls`

Search and filter calls.

**Query Params:**

| Param       | Type   | Default  | Description                                           |
| ----------- | ------ | -------- | ----------------------------------------------------- |
| `q`         | string | —        | Keyword search in transcript content                  |
| `agent_id`  | string | —        | Filter by agent UUID                                  |
| `sentiment` | string | —        | Filter: `positive`, `neutral`, `negative`             |
| `date_from` | string | —        | ISO date, inclusive start                             |
| `date_to`   | string | —        | ISO date, inclusive end                               |
| `topic`     | string | —        | Filter by topic name                                  |
| `sort`      | string | `recent` | `recent`, `oldest`, `sentiment_asc`, `sentiment_desc` |
| `page`      | int    | `1`      | Pagination                                            |
| `per_page`  | int    | `20`     | Items per page                                        |

**Response `200`:**

```json
{
  "calls": [
    {
      "id": "uuid",
      "agent_id": "uuid",
      "agent_name": "Marcus Johnson",
      "started_at": "2026-02-28T14:30:00Z",
      "duration_seconds": 310,
      "sentiment_score": -0.35,
      "sentiment_label": "negative",
      "topics": ["billing", "refund"],
      "summary": "Customer called about an incorrect charge on their account..."
    }
  ],
  "total": 87,
  "page": 1,
  "per_page": 20
}
```

---

## SHARED — CALL DETAIL

### GET `/api/calls/{call_id}`

Full detail for a single call. Used by the `CallDetailDrawer` component when a supervisor clicks a call from Alerts or Search.

**Response `200`:**

```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "agent_name": "Marcus Johnson",
  "customer_name": "Linda Martinez",
  "started_at": "2026-02-28T14:30:00Z",
  "duration_seconds": 310,
  "sentiment_score": -0.35,
  "sentiment_label": "negative",
  "is_resolved": false,
  "topics": ["billing", "refund"],
  "summary": "Customer called about an incorrect charge...",
  "key_moves": ["Acknowledged frustration early", "Offered clear next steps"],
  "keywords": ["billing", "customer service", "resolution", "account"],
  "transcript": [
    {
      "speaker": "customer",
      "text": "Hi, I have a billing issue...",
      "timestamp": "00:00:08"
    },
    {
      "speaker": "agent",
      "text": "I'm sorry to hear that. Let me look into it.",
      "timestamp": "00:00:15"
    }
  ],
  "recording_url": null
}
```

**Errors:** `404` call not found

---

## SHARED — NOTES

### GET `/api/calls/{call_id}/notes`

List all notes on a call. Notes are added by supervisors during review.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "notes": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_name": "Ada",
      "content": "lgtm",
      "created_at": "2026-03-04T18:17:29Z"
    }
  ]
}
```

**Errors:** `404` call not found

---

### POST `/api/calls/{call_id}/notes`

Add a note to a call.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "content": "lgtm"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "user_name": "Ada",
  "content": "lgtm",
  "created_at": "2026-03-04T18:17:29Z"
}
```

**Errors:** `404` call not found, `422` empty content

---

## SHARED — ACTIONS

### POST `/api/exemplars`

Mark a call as exemplary. Supervisor action from the CallDetailDrawer "Mark as Exemplar" button.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "call_id": "uuid",
  "note": "Excellent de-escalation technique and empathy throughout"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "call_id": "uuid",
  "agent_id": "uuid",
  "agent_name": "Lisa Park",
  "sentiment_score": 0.85,
  "sentiment_label": "positive",
  "duration_seconds": 310,
  "topics": ["account setup"],
  "note": "Excellent de-escalation technique and empathy throughout",
  "created_at": "2026-03-04T18:20:00Z"
}
```

**Errors:** `404` call not found, `409` call already marked as exemplar

---

## SUPERVISOR — BRIEFS

### GET `/api/briefs`

List previously generated daily briefs.

**Query Params:**

| Param      | Type | Default | Description    |
| ---------- | ---- | ------- | -------------- |
| `page`     | int  | `1`     | Pagination     |
| `per_page` | int  | `10`    | Items per page |

**Response `200`:**

```json
{
  "briefs": [
    {
      "id": "uuid",
      "title": "Daily Brief — Feb 28, 2026",
      "generated_at": "2026-02-28T18:00:00Z",
      "period_start": "2026-02-28",
      "period_end": "2026-02-28",
      "summary": "187 calls handled. Average sentiment 0.42. 5 critical alerts...",
      "total_calls": 187,
      "avg_sentiment": 0.42,
      "top_topics": ["billing", "refund", "account setup"],
      "highlights": [
        "Agent Lisa Park had 100% positive sentiment across 8 calls",
        "3 escalations related to billing disputes"
      ]
    }
  ],
  "total": 14,
  "page": 1,
  "per_page": 10
}
```

---

### POST `/api/briefs/generate`

Generate a new daily brief for a date range.

**Request Body:**

```json
{
  "date_from": "2026-02-28",
  "date_to": "2026-02-28"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "title": "Daily Brief — Feb 28, 2026",
  "generated_at": "2026-02-28T18:05:00Z",
  "period_start": "2026-02-28",
  "period_end": "2026-02-28",
  "summary": "Generated brief content...",
  "total_calls": 187,
  "avg_sentiment": 0.42,
  "top_topics": ["billing", "refund"],
  "highlights": [
    "Agent Lisa Park had strongest performance",
    "Billing remains top concern"
  ]
}
```

---

### GET `/api/briefs/{brief_id}/export`

Export a brief as CSV or PDF.

**Query Params:**

| Param    | Type   | Default | Description    |
| -------- | ------ | ------- | -------------- |
| `format` | string | `csv`   | `csv` or `pdf` |

**Response `200`:**

- `Content-Type: text/csv` or `application/pdf`
- `Content-Disposition: attachment; filename="brief-2026-02-28.csv"`
- File binary content

**Errors:** `404` brief not found

---

## SUPERVISOR — SETTINGS

### GET `/api/settings`

Get current supervisor/team settings.

**Response `200`:**

```json
{
  "sentiment_thresholds": {
    "negative_below": -0.3
  },
  "tracked_keywords": ["cancel", "refund", "escalate", "manager", "complaint"],
  "data_retention_days": 90
}
```

---

### PATCH `/api/settings`

Update one or more settings. All fields optional.

**Request Body:**

```json
{
  "sentiment_thresholds": {
    "negative_below": -0.25
  },
  "tracked_keywords": ["cancel", "refund", "escalate", "angry"],
  "data_retention_days": 60
}
```

**Response `200`:** Full settings object (same shape as GET) with updated values.

---

## AGENT — PERFORMANCE

### GET `/api/agent/performance`

Personal KPIs, weekly trend, and anonymized team comparison.

**Query Params:** None

**Response `200`:**

```json
{
  "total_calls": 18,
  "avg_sentiment": 0.34,
  "percentile": 72,
  "weekly_trend": [{ "day": "Mon", "sentiment": 0.45, "calls": 4 }],
  "team_comparison": {
    "agent_avg": 0.34,
    "p25": -0.15,
    "p50": 0.2,
    "p75": 0.45
  }
}
```

---

## AGENT — COACHING TIPS

### GET `/api/agent/coaching-tips`

**Query Params:**

| Param       | Type | Default | Description            |
| ----------- | ---- | ------- | ---------------------- |
| `dismissed` | bool | `false` | Include dismissed tips |

**Response `200`:**

```json
{
  "tips": [
    {
      "id": "uuid",
      "call_id": "uuid",
      "created_at": "2026-02-28T15:00:00Z",
      "content": [
        "Acknowledge wait time explicitly before troubleshooting",
        "Offer a concrete timeline for resolution"
      ],
      "reason": "Based on: negative sentiment detected, call not resolved",
      "helpful": null,
      "bookmarked": false,
      "dismissed": false
    }
  ]
}
```

---

### PATCH `/api/agent/coaching-tips/{tip_id}`

**Request Body** (all fields optional):

```json
{ "helpful": true, "bookmarked": true, "dismissed": false }
```

**Response `200`:** Updated tip object.

**Errors:** `404` tip not found or not owned by agent

---

## AGENT — EXEMPLARS

### GET `/api/agent/exemplars`

**Query Params:**

| Param   | Type   | Default | Description          |
| ------- | ------ | ------- | -------------------- |
| `topic` | string | —       | Filter by topic name |

**Response `200`:**

```json
{
  "exemplars": [
    {
      "id": "uuid",
      "call_id": "uuid",
      "agent_name": "Lisa Park",
      "sentiment_score": 0.85,
      "sentiment_label": "positive",
      "duration_seconds": 310,
      "topics": ["account setup"],
      "note": "Excellent onboarding flow — used all best practices",
      "created_at": "2026-02-20T10:00:00Z"
    }
  ]
}
```

---

### GET `/api/agent/exemplars/{exemplar_id}`

**Response `200`:**

```json
{
  "id": "uuid",
  "call_id": "uuid",
  "agent_name": "Lisa Park",
  "sentiment_score": 0.85,
  "sentiment_label": "positive",
  "duration_seconds": 310,
  "topics": ["account setup"],
  "note": "Excellent onboarding flow",
  "key_moves": [
    "Acknowledged customer frustration early",
    "Offered clear next steps",
    "Confirmed resolution before ending"
  ],
  "transcript": [
    {
      "speaker": "customer",
      "text": "Hi, I need help setting up my new account.",
      "timestamp": "00:00:05"
    },
    {
      "speaker": "agent",
      "text": "I'd be happy to help you with that!",
      "timestamp": "00:00:12"
    }
  ],
  "recording_url": null,
  "created_at": "2026-02-20T10:00:00Z"
}
```

**Errors:** `404` exemplar not found or not on agent's team

---

## AGENT — NOTIFICATIONS

### GET `/api/agent/notifications`

**Response `200`:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "coaching_tip",
      "title": "New coaching tip available",
      "body": "You have a new tip based on your call at 2:30 PM",
      "reference_type": "coaching_tip",
      "reference_id": "uuid",
      "is_read": false,
      "created_at": "2026-02-28T15:00:00Z"
    }
  ],
  "unread_count": 3
}
```

---

### PATCH `/api/agent/notifications/read-all`

**Response `200`:**

```json
{ "marked": 3 }
```

---

## ROUTE SUMMARY TABLE

| #   | Method | Path                                 | Role       | Page/Component           |
| --- | ------ | ------------------------------------ | ---------- | ------------------------ |
| 1   | POST   | `/api/auth/register`                 | Supervisor | User onboarding          |
| 2   | POST   | `/api/auth/login`                    | Both       | Sign-in page             |
| 3   | POST   | `/api/auth/logout`                   | Both       | Nav bar sign-out         |
| 4   | GET    | `/api/auth/me`                       | Both       | App-wide (session check) |
| 5   | POST   | `/api/auth/refresh`                  | Both       | Token refresh (silent)   |
| 6   | POST   | `/api/auth/forgot-password`          | Both       | Forgot password page     |
| 7   | POST   | `/api/auth/reset-password`           | Both       | Reset password page      |
| 8   | PATCH  | `/api/auth/change-password`          | Both       | Settings / profile       |
| 9   | GET    | `/api/dashboard/metrics`             | Supervisor | Overview                 |
| 10  | GET    | `/api/alerts`                        | Supervisor | Alerts                   |
| 11  | PATCH  | `/api/alerts/{alert_id}`             | Supervisor | Alerts                   |
| 12  | PATCH  | `/api/alerts/read-all`               | Supervisor | Alerts                   |
| 13  | POST   | `/api/alerts`                        | Supervisor | CallDetailDrawer         |
| 14  | GET    | `/api/agents`                        | Supervisor | Search (agent dropdown)  |
| 15  | GET    | `/api/calls`                         | Supervisor | Search                   |
| 16  | GET    | `/api/calls/{call_id}`               | Both       | CallDetailDrawer         |
| 17  | GET    | `/api/calls/{call_id}/notes`         | Both       | CallDetailDrawer         |
| 18  | POST   | `/api/calls/{call_id}/notes`         | Both       | CallDetailDrawer         |
| 19  | POST   | `/api/exemplars`                     | Supervisor | CallDetailDrawer         |
| 20  | GET    | `/api/briefs`                        | Supervisor | Briefs                   |
| 21  | POST   | `/api/briefs/generate`               | Supervisor | Briefs                   |
| 22  | GET    | `/api/briefs/{brief_id}/export`      | Supervisor | Briefs                   |
| 23  | GET    | `/api/settings`                      | Supervisor | Settings                 |
| 24  | PATCH  | `/api/settings`                      | Supervisor | Settings                 |
| 25  | GET    | `/api/agent/performance`             | Agent      | Performance              |
| 26  | GET    | `/api/agent/coaching-tips`           | Agent      | Home                     |
| 27  | PATCH  | `/api/agent/coaching-tips/{tip_id}`  | Agent      | Home                     |
| 28  | GET    | `/api/agent/exemplars`               | Agent      | Exemplars                |
| 29  | GET    | `/api/agent/exemplars/{exemplar_id}` | Agent      | Exemplars                |
| 30  | GET    | `/api/agent/notifications`           | Agent      | Notifications            |
| 31  | PATCH  | `/api/agent/notifications/read-all`  | Agent      | Notifications            |

---
