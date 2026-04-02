# Database Schema Design

The idea behind this is to create a living document that would continue to be updated as the schema changes.

## Requirements Satisfied

### Agents

- [x] Handle calls
- [x] View personal metrics.
- [x] Receive coaching tips
- [x] See examplars marked by supervisors on that team

### Supervisors

- [x] Set Alert preferences
- [x] Review Calls
- [x] Store generated reports

---

## Tables at a Glance

| # | Table | Purpose |
|---|-------|---------|
| 1 | `users` | Agents and supervisors |
| 2 | `teams` | Groups of agents under one supervisor |
| 3 | `calls` | Raw call records |
| 4 | `call_analyses` | AI-generated insights per call |
| 5 | `topics` | Predefined topic list |
| 6 | `keywords` | Predefined keyword list |
| 7 | `call_analysis_topics` | Links calls <-> topics |
| 8 | `call_analysis_keywords` | Links calls <-> keywords |
| 9 | `alert_configurations` | Supervisor-defined alert rules |
| 10 | `alerts` | Triggered alerts for bad calls |
| 11 | `exemplar_calls` | Calls marked as good examples |
| 12 | `coaching_tips` | AI tips for agents |
| 13 | `notifications` | User notification inbox |
| 14 | `briefs` | Stored team reports |
| 15 | `notes` | User notes on calls |
| 16 | `sample_transcripts` | Sample transcript data for testing/training |

---

## 💡 Entity Relationship Diagrams (ERDs)

###  **[Click to see the ERDs](https://dbdiagram.io/d/AWS-Connect-Insights-698cc7c8bd82f5fce26e4beb)**

---

## 💡 Table Definitions

### 1. `users`

> Can either be agents or supervisors. We can extend the supabase user object which would allow easy authentication.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** | Matches auth.users.id |
| `email` | VARCHAR(255) | User email |
| `first_name` | VARCHAR(255) |  |
| `last_name` | VARCHAR(255) |  |
| `role` | ENUM | `agent` · `supervisor` |
| `team_id` | **Foreign Key** → teams, nullable | User's team id, not required at creation |
| `created_at` | TIMESTAMP |  |
| `updated_at` | TIMESTAMP |  |

---

### 2. `teams`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key**  |  |
| `name` | VARCHAR(255) | Team name |
| `supervisor_id` | **Foreign Key** → users  | supervisor user id |
| `created_at` | TIMESTAMP |  |
| `updated_at` | TIMESTAMP |  |


For insertion, we'd do the following:

- Create supervisor user with team_id = NULL
- Then create team with supervisor_id = new user's ID
- Finally supervisor's team_id to point to new team

---

### 3. `calls`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `agent_id` | **Foreign Key** → users | Agent who took the call |
| `team_id` | **Foreign Key** → teams | Denormalized for fast queries |
| `recording_url` | TEXT | Audio file location |
| `transcript` | JSONB | Array of `{speaker, text}` objects |
| `duration_seconds` | INTEGER | Call length |
| `started_at` | TIMESTAMP | Call start time |
| `created_at` | TIMESTAMP |  |

💡 Team ID does seem redundant since we have agent ID and can get the information from the agent table but it could cause issues if the agent changes teams. This way all call history remains on the team.

💡 We also may not need an 'ended_at' field since we can just use calculate that on the frontend using duration + started_at

💡 Note: Transcript is now stored here (not in `call_analyses`) so we can re-run analysis without re-transcribing.

---

### 4. `call_analyses`

> AI-generated insights, one per call

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `call_id` | **Foreign Key** → calls, UNIQUE | One analysis per call |
| `summary` | TEXT | AI summary |
| `sentiment_score` | DECIMAL | -1.0 (negative) to 1.0 (positive) |
| `sentiment_label` | ENUM | `positive` · `neutral` · `negative` |
| `key_moves` | JSONB | Array of strings describing agent techniques/actions |
| `is_resolved` | BOOLEAN | Was issue resolved? |
| `created_at` | TIMESTAMP |  |
| `updated_at` | TIMESTAMP |  |

💡 See `calls` table above as transcript has been moved there.

💡 Another option is adding these fields directly in the calls table. The issue with that though would be that if we decide to change something major about our analysis, that would probably mess with our call records. So it might be better to have the call record separate and then store any analysis on it separately also.

💡 `key_moves` is stored here (not in `exemplar_calls`) so all calls have access to AI-identified techniques for coaching and pattern analysis.

---

### 5. `topics`

> Predefined list (e.g., billing, refund, technical_support)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `name` | VARCHAR(100), UNIQUE | Topic name |
| `description` | TEXT | Optional explanation |
| `is_active` | BOOLEAN | Optional disable |
| `created_at` | TIMESTAMP |  |

💡 The optional disable exists in case we no longer need a tag and some other calls have already used it as deleting could cause issues.


---

### 6. `keywords`

> Predefined list (e.g., cancel, frustrated, manager)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `word` | VARCHAR(100), UNIQUE | The keyword |
| `is_active` | BOOLEAN | Optional disable |
| `created_at` | TIMESTAMP |  |

💡 Mostly the same idea as the topic table.

---

### 7. `call_analysis_topics`

> Join table: many-to-many between analyses and topics

| Column | Type |
|--------|------|
| `id` | UUID, **Primary key** |
| `call_analysis_id` | **Foreign Key** → call_analyses |
| `topic_id` | **Foreign Key** → topics |

💡 Here we could alternatively use an enum instead and that'd mean adding them directly to the call table or even its own unique table. The issue would then be that if we wanted to filter by topics, we'd have to do an array search for all the rows in the table.

---

### 8. `call_analysis_keywords`

> Join table: many-to-many between analyses and keywords

| Column | Type |
|--------|------|
| `id` | UUID, **Primary key** |
| `call_analysis_id` | **Foreign Key** → call_analyses |
| `keyword_id` | **Foreign Key** → keywords |

💡 Same idea as  `call_analysis_topics`

---

### 9. `alert_configurations`

> Rules supervisors create to trigger alerts

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** | |
| `supervisor_id` | **Foreign Key** → users | Alert rule owner |
| `team_id` | **Foreign Key** → teams | Applies to this team |
| `type` | ENUM | `threshold` · `keyword` |
| `sentiment_threshold` | DECIMAL | For threshold type |
| `keyword_id` | **Foreign Key** → keywords | For keyword type |
| `is_active` | BOOLEAN | Enable/disable |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

💡 Each rule triggers independently (OR logic). So if a supervisor has settings of < 0.5 sentiments and keywords "negative" and "refund", we create 3 separate entries. This makes it easier to update if the supervisor decides to remove one of them and leave the rest.

---

### 10. `alerts`

> Generated when calls match alert rules (one alert per call max)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** | |
| `call_id` | **Foreign Key** → calls, UNIQUE | One alert per call |
| `supervisor_id` | **Foreign Key** → users | Alert recipient |
| `team_id` | **Foreign Key** → teams | |
| `type` | ENUM | `threshold` · `keyword` · `manual` |
| `status` | ENUM | `open` · `closed` |
| `severity` | ENUM | `low` · `medium` · `high` |
| `title` | VARCHAR(255) | Alert headline |
| `description` | TEXT | Alert details |
| `is_read` | BOOLEAN | Read status |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

💡 Making call_id unique helps ensure we can only get one alert per call.

💡 **Severity calculation (standardized):** We can manually decide on ranges for call severity


---

### 11. `exemplar_calls`

> Calls marked as good examples

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** | |
| `call_id` | **Foreign Key** → calls, UNIQUE | The exemplary call |
| `team_id` | **Foreign Key** → teams | Visible to this team |
| `marked_by` | **Foreign Key** → users | Supervisor who marked it |
| `note` | TEXT | Why it's a good example |
| `created_at` | TIMESTAMP | |

💡 We can get examplar calls transcript using a join on `call_id` → `calls.transcript`.

💡 `key_moves` is accessed via the call's analysis (`call_id` → `call_analyses.key_moves`), not stored here.

💡 Again, this could also be part of the calls table and is very much up for discussion but in light of trying to treat the calls table as the source of truth, this might be the better option since we also might want to add more content as to why the call is an examplar later on.

---

### 12. `coaching_tips`

> AI-generated improvement tips for agents

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `agent_id` | **Foreign Key** → users | Recipient |
| `content` | JSONB | Array of tip strings |
| `reason` | TEXT | Why the tip was generated |
| `based_on_call_id` | **Foreign Key** → calls | Source call (optional) |
| `is_read` | BOOLEAN | Read status |
| `helpful` | BOOLEAN | Agent feedback - was tip useful? |
| `bookmarked` | BOOLEAN DEFAULT false | Agent can save tips |
| `dismissed` | BOOLEAN DEFAULT false | Agent can dismiss tips |
| `created_at` | TIMESTAMP |  |

💡 Content is stored as JSONB array to support multiple tips per coaching session.

---

### 13. `notifications`

> Unified inbox for all notification types

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `user_id` | **Foreign Key** → users | Recipient |
| `type` | ENUM | `alert` · `coaching_tip` · `exemplar_added` |
| `title` | VARCHAR(255) | Headline |
| `body` | TEXT | Full content |
| `reference_type` | ENUM | `call` · `alert` · `coaching_tip` · `exemplar_call` |
| `reference_id` | UUID | Entity ID for navigation |
| `is_read` | BOOLEAN | Read status |
| `created_at` | TIMESTAMP |  |
| `updated_at` | TIMESTAMP |  |

---

### 14. `briefs`

> Stored team performance reports

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** |  |
| `team_id` | **Foreign Key** → teams |  |
| `generated_by` | **Foreign Key** → users | Requesting supervisor |
| `period_start` | DATE | Report start |
| `period_end` | DATE | Report end |
| `total_calls` | INTEGER | Calls in period |
| `average_sentiment` | DECIMAL |  |
| `positive_call_percentage` | DECIMAL |  |
| `negative_call_percentage` | DECIMAL |  |
| `top_issues` | JSONB | Common issues |
| `content` | JSONB | Full brief + exemplar IDs |
| `created_at` | TIMESTAMP |  |

💡 This would also store some AI generated content so using JSON may not be the best long term since some models might not follow the instructions. Putting the JSON as a place holder for now.

---

### 15. `notes`

> User notes on calls

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** | |
| `call_id` | **Foreign Key** → calls | Which call |
| `user_id` | **Foreign Key** → users | Who wrote it |
| `content` | TEXT | Note text |
| `created_at` | TIMESTAMP | |

---

### 16. `sample_transcripts`

> Sample transcript data for testing and training purposes (standalone, not linked to other tables)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, **Primary key** | Auto-generated |
| `transcript` | JSONB | Array of `{speaker, text}` objects |

💡 This table stores standalone transcript samples that are not associated with actual calls. Used for simulation, testing, training, and development purposes. Format matches the `transcript` field in the `calls` table for consistency.

💡 The app picks one random sample transcript from this pool, then runs the canonical analysis flow to determine sentiment, topics, and coaching signals.

---

## Relationships

| Relationship | Type |
|--------------|------|
| Team → Agents | One-to-Many |
| Team → Supervisor | One-to-One (via users table with role check) |
| Agent → Calls | One-to-Many |
| Call → Analysis | One-to-One |
| Analysis ↔ Topics | Many-to-Many |
| Analysis ↔ Keywords | Many-to-Many |
| Supervisor → Alert Configs | One-to-Many |
| Call → Alert | One-to-One (optional) |
| Call → Exemplar | One-to-One (optional) |
| Agent → Coaching Tips | One-to-Many |
| User → Notifications | One-to-Many |
| Team → Briefs | One-to-Many |
| Call → Notes | One-to-Many |

---

## Enums


user_role:  `agent`, `supervisor`

sentiment_label:  `positive`, `neutral`, `negative`

alert_type:  `threshold`, `keyword`, `manual`

alert_status:  `open`, `closed`

alert_severity:  `low`, `medium`, `high`

notification_type:  `alert`, `coaching_tip`, `exemplar_added`

notification_reference_type:  `call`, `alert`, `coaching_tip`, `exemplar_call`


---

## 💡 Key Design Decisions

| Decision | Why |
|----------|-----|
| Separate `call_analyses` table | Analysis runs on its own, can always re-run or use better models without touching the actual core call data |
| Separate `exemplar_calls` table | Easy to extend, would also avoid NULL columns on most calls since not all would be examplars |
| Denormalized `team_id` on calls/alerts | Faster queries, and would make it easy for use to know what team the call belongs to as opposed to fining the team through an agent that might have switched |

---

## 💡 Open Questions

- [ ] How  do we want to handle it when we delete a call and how do we handle all its other associated information?
- [ ] Check for normalization and denormalization and make plan for how to handle them.
- [ ] Calls currently are tied to a team meaning that if the user changes team that information starts to seem redundant
- [ ] Decide on whether to add ended_at from the calls since that can be calculated using the started_at + duration
- [ ] Thoughts on having call analysis as a separate table.
- [x] For alerts status, just realized a boolean might even be simpler like is_read (RESOLVED)
- [ ] It does indeed seem like a lot of tables, so i'd love to hear thoughts and alternatives.

---
