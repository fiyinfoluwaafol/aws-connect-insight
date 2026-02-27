# API Plan for Supervisor & Agent Dashboard

## SUPERVISOR

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
      "date": "2026-02-13",
      "avg_sentiment": 0.35,
      "call_count": 14,
      "avg_duration": 312,
      "negative_percent": 28.6
    }
  ],
  "top_topics": [
    { "name": "billing", "count": 42 },
    { "name": "refund", "count": 31 }
  ],
  "sentiment_distribution": {
    "positive": 98,
    "neutral": 52,
    "negative": 37
  },
  "agent_stats": [
    {
      "agent_id": "uuid",
      "name": "Jane",
      "avg_sentiment": 0.71,
      "call_count": 28
    }
  ]
}
```

---

## AGENT

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

### GET `/api/agent/coaching-tips`

List coaching tips for the authenticated agent.

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
      "created_at": "2026-02-27T10:00:00Z",
      "content": [
        "Try acknowledging the customer's frustration earlier",
        "Ensure clear next steps before ending"
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

Update feedback on a coaching tip.

**Request Body** (all fields optional):

```json
{ "helpful": true, "bookmarked": true, "dismissed": false }
```

**Response `200`:** Updated tip object (same shape as above).

**Errors:** `404` tip not found or not owned by agent

---

### GET `/api/agent/exemplars`

List exemplar calls for the agent's team.

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
      "agent_name": "Jane Doe",
      "duration_seconds": 420,
      "sentiment_score": 0.85,
      "sentiment_label": "positive",
      "topics": ["billing", "upsell"],
      "note": "Great empathy and resolution",
      "created_at": "2026-02-20T14:00:00Z"
    }
  ]
}
```

---

### GET `/api/agent/exemplars/{exemplar_id}`

Full detail for one exemplar call (transcript + key moves).

**Query Params:** None

**Response `200`:**

```json
{
  "id": "uuid",
  "call_id": "uuid",
  "agent_name": "Christopher Lee",
  "duration_seconds": 310,
  "sentiment_score": 0.85,
  "sentiment_label": "positive",
  "topics": ["account-setup"],
  "note": "Great empathy and resolution",
  "created_at": "2026-02-20T14:00:00Z",
  "key_moves": [
    "Acknowledged customer frustration early",
    "Offered clear next steps",
    "Confirmed resolution before ending"
  ],
  "transcript": [
    {
      "speaker": "customer",
      "text": "Hi, I need help setting up my new account."
    },
    { "speaker": "agent", "text": "I'd be happy to help you with that!" }
  ],
  "audio_url": null
}
```

**Errors:** `404` exemplar not found or not on agent's team

---

### GET `/api/agent/notifications`

Notification inbox for the authenticated agent.

**Query Params:** None

**Response `200`:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "coaching_tip",
      "title": "New coaching tips available",
      "body": "New coaching tips available for your recent call",
      "reference_type": "coaching_tip",
      "reference_id": "uuid",
      "is_read": false,
      "created_at": "2026-02-27T10:00:00Z"
    }
  ],
  "unread_count": 3
}
```

---

### PATCH `/api/agent/notifications/read-all`

Mark all notifications as read.

**Request Body:** None

**Response `200`:**

```json
{ "marked": 5 }
```