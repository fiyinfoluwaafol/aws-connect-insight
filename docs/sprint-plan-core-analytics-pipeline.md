# Sprint Plan: Core Call Analytics Pipeline

> **Status:** AI-Generated Raw Output — ready for team review and refinement  
> **Generated:** 2026-03-30  
> **Based on:** Open issues from `issues.csv`, sprint direction from `core-call-analytics-endpoint-issues.md`, API contracts from `dashboard-api-endpoints.md`, and database schema from `datamodel-schema.md`

---

## 1. Sprint Goal

**Deliver a working core call analytics pipeline that ingests transcripts, generates structured analytics (sentiment, summaries, topics), persists results to the database, and exposes them through authenticated API endpoints for both the supervisor dashboard and agent performance views.**

---

## 3. In-Scope Issues

### Phase 1 — Contracts and Definitions

These issues define the data shapes, metric rules, and parameter formats that all downstream implementation depends on. They must be settled first to prevent rework.

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#19** | F5.1: Define call-level summary and analytics contract | Analytics schema | Defines what fields are produced per call (sentiment, topics, summary). Every persistence and query task depends on this. |
| **#14** | F3.1: Define historical metrics and time granularity | Historical storage contract | Defines what metrics are stored historically and at what resolution. Required before building time-range queries or dashboard aggregation. |
| **#28** | F9.1: Define agent performance metrics and dashboard contract | Agent performance contract | Defines what the agent performance endpoint returns. Must align with `dashboard-api-endpoints.md`. |
| **#40** | F2.1: Define alert types and thresholds | Alert detection rules | Defines what triggers a negative sentiment or recurring issue alert. Required before implementing detection logic. |
| **#17** | F4.1: Define supported filters and search parameters | Query parameter contract | Defines the filter/search interface the backend will support. Informs query layer design and API parameter validation. |

### Phase 2 — Database Helpers and Persistence

These issues build the storage layer that analytics processing writes to and API endpoints read from.

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#105** | INF2.4: Add call analysis database helpers | Core DB access | Provides create/read/update helpers for `call_analyses`, topic and keyword linking. The fundamental data access layer for the pipeline. |
| **#59** | F5.4: Persist call summaries and analytics | Call-level persistence | Saves generated summaries and analytics to the database, linked to call records. |
| **#15** | F3.2: Persist historical analytics metrics | Historical persistence | Stores per-call or per-day analytics records that support trend analysis and time-range queries. |
| **#11** | F2.4: Persist alert records | Alert persistence | Saves generated alerts when negative sentiment or recurring issues are detected. Needed because `GET /api/dashboard/metrics` returns `open_alerts` count. |

### Phase 3 — Analytics Processing

These issues implement the core intelligence: turning raw transcripts into structured analytics.

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#20** | F5.2: Implement AI-based call summary generation | Summary generation | Generates concise summaries from call transcripts using NLP (AWS Bedrock or mocked fallback). |
| **#21** | F5.3: Generate call-level analytics | Analytics extraction | Computes sentiment scores, extracts topics and issue tags from transcripts. The core transformation step. |
| **#41** | F2.2: Detect negative sentiment during analytics processing | Sentiment alerting | Evaluates sentiment scores against thresholds to flag negative calls. Produces alert-triggering signals as part of processing. |

### Phase 4 — Query and Aggregation

These issues implement the reusable query logic that API endpoints call to produce aggregated responses.

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#16** | F3.3: Implement time-range analytics query logic | Time-range queries | Retrieves historical analytics for date ranges and aggregates by granularity. Powers both dashboard charts and trend endpoints. |
| **#10** | F1.2: Implement dashboard metrics aggregation logic | Supervisor aggregation | Computes summary metrics (avg sentiment, call count, negative %, top topics) from stored analytics. Directly backs `GET /api/dashboard/metrics`. |
| **#29** | F9.2: Implement agent-level analytics query logic | Agent aggregation | Queries analytics scoped to a single agent, aggregates over time. Directly backs `GET /api/agent/performance`. |

### Phase 5 — API Endpoints

These issues expose the pipeline's output to the frontend through documented REST contracts.

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#60** | F5.5: Create call-level analytics API endpoint | Per-call API | Exposes summary and analytics for individual calls via `GET /api/calls/{id}/analytics`. |
| **#47** | F3.4: Create historical analytics API endpoint | Trends API | Exposes time-range analytics via `GET /api/analytics/trends`. |
| **#77** | F9.3: Create agent performance API endpoint | Agent performance API | Exposes `GET /api/agent/performance` with KPIs, weekly trend, and team comparison. |

### Phase 6 — Authentication and Integration

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#92** | Replace mock authentication with Supabase Auth integration | Auth infrastructure | All analytics endpoints must be protected. Without real auth, there is no team scoping and no agent identity for performance queries. |
| **#128** | Investigate Call Ingestion Approaches for Analytics Pipeline | Ingestion design | The pipeline needs a defined input path. This research task determines how transcripts enter the system for the MVP. |

### Phase 7 — Frontend Shell (End-to-End Demonstration)

| # | Title | Pipeline Role | Reason for Inclusion |
|---|-------|--------------|---------------------|
| **#61** | F5.6: Build call-level analytics UI layout | Analytics display | Provides the frontend surface for viewing per-call analytics. Can begin with placeholder data and later wire to the API. Included to demonstrate end-to-end progress. |

**Total in-scope: 21 issues**

---

## 4. Out-of-Scope Issues

### Refactoring

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #134 | Extract Shared Utility Functions and Domain Constants | Code quality improvement. Does not contribute to the analytics pipeline. Tackle after pipeline is stable. |
| #133 | Extract a Data Access Layer with a Service Interface | Important long-term, but the pipeline must work first before abstracting the data access pattern. |
| #132 | Decouple Export Logic from MockService | Frontend refactor. Export features (PDF/CSV) are not part of the analytics pipeline. |
| #131 | F1.7: Decompose Monolithic Supervisor Pages | Frontend refactor. Structural cleanup that does not advance pipeline functionality. |
| #129 | Lab 3 - AI-Assisted Refactoring with Cursor | Meta/lab task, not a sprint deliverable. |

### Feature F1 — Dashboard (UI layers)

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #34 | F1.0: AI-Powered Interaction Dashboard | Epic-level umbrella issue, not an actionable task. |
| #36 | F1.4: Create dashboard metrics UI layout | Frontend layout. Sprint covers backend pipeline; dashboard UI wiring deferred to next sprint. |
| #37 | F1.5: Connect dashboard UI to metrics API | Depends on API endpoints being complete. Good candidate for early next sprint. |
| #38 | F1.6: Add basic error & loading states | UX polish. Not pipeline-critical. |

### Feature F2 — Alerts (beyond detection and persistence)

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #39 | F2: Sentiment & Issue Alerts | Epic umbrella. Sub-tasks #40, #41, #11 are included. |
| #42 | F2.3: Detect recurring issues across calls | Requires sufficient analytics volume. Deferred until the basic pipeline produces enough data. |
| #12 | F2.5: Create alerts API endpoint | Alerts API is not one of the two documented core endpoints. Can be built once persistence and detection are working. |
| #13 | F2.6: Build alerts UI section in dashboard | Frontend. Not pipeline-critical. |
| #43 | F2.7: Connect alerts UI to alerts API | Frontend integration. Deferred. |
| #44 | F2.8: Add basic alert handling UX | UX polish. Deferred. |

### Feature F3 — Historical Analytics (UI layers)

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #45 | F3: Historical & Trend Analytics | Epic umbrella. Sub-tasks are included where needed. |
| #48 | F3.5: Build trend charts UI layout | Frontend layout. Deferred. |
| #49 | F3.6: Connect trend charts to analytics API | Frontend integration. Deferred. |
| #50 | F3.7: Add loading and empty-state handling | UX polish. Deferred. |

### Feature F4 — Search & Filtering (beyond definitions)

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #51 | F4: Advanced Filtering & Search | Epic umbrella. |
| #18 | F4.2: Implement backend filtering logic | Useful but not part of the core analytics generation/aggregation pipeline. The definition (#17) is included to inform query design. |
| #52 | F4.3: Implement backend keyword search logic | Search is a consumer of analytics data, not a producer. Deferred. |
| #53 | F4.4: Create filtering and search API endpoint | Deferred until filtering logic exists. |
| #54 | F4.5: Build filtering and search UI controls | Frontend. Deferred. |
| #55 | F4.6: Display filtered search results | Frontend. Deferred. |
| #56 | F4.7: Connect search UI to backend API | Frontend integration. Deferred. |
| #57 | F4.8: Add loading, empty, and error states | UX polish. Deferred. |

### Feature F5 — Call Summaries (UI integration beyond #61)

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #58 | F5: AI-Generated Call Summaries & Analytics | Epic umbrella. Sub-tasks are included. |
| #62 | F5.7: Connect call analytics UI to backend API | Depends on both the API endpoint and UI layout being complete. Good candidate for late-sprint or next sprint. |
| #63 | F5.8: Add loading, empty, and error states | UX polish. Deferred. |

### Feature F6 — Performance Briefs

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #64, #22, #23, #65, #66, #67, #68, #69 | F6 (all sub-tasks) | Briefs depend on aggregated analytics. The aggregation layer built in this sprint unblocks briefs, but brief generation and display are a separate feature scope. |

### Feature F7 — Post-Call Coaching Feedback

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #70, #24, #25, #71, #72, #73, #74, #75 | F7 (all sub-tasks) | Coaching is a downstream consumer of call analytics. The analytics pipeline must work before coaching can use its outputs. |

### Feature F8 — Best-Call Learning Library

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #81, #26, #27, #82, #83, #84, #85, #86 | F8 (all sub-tasks) | Requires analytics to identify high-performing calls. Not part of the core pipeline. |

### Feature F9 — Agent Dashboard (UI layers)

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #76 | F9: Personal Agent Performance Dashboard | Epic umbrella. Backend sub-tasks #28, #29, #77 are included. |
| #78 | F9.4: Build agent performance dashboard UI layout | Frontend. Deferred. |
| #79 | F9.5: Connect agent dashboard UI to backend API | Frontend integration. Deferred. |
| #80 | F9.6: Add loading, empty, and error states | UX polish. Deferred. |

### Infrastructure / Enhancements

| # | Title | Reason for Exclusion |
|---|-------|---------------------|
| #117 | Look into providing pagination support | Enhancement. Not blocking for pipeline. |
| #99 | Look into better ways to handle notification references | Notifications are out of scope for this sprint. |
| #98 | Explore better ways to store alert rule configurations | Alert config optimization is not pipeline-critical. |

---

## 5. Task Breakdown and Assignments

### Kiitan — Analytics Engine Lead

Kiitan owns the core AI/NLP processing layer: defining what analytics look like, generating summaries and structured insights from transcripts, and implementing sentiment-based detection logic.

| # | Issue | Description | Dependencies | Deliverable |
|---|-------|-------------|--------------|-------------|
| **#19** | F5.1: Define call-level summary and analytics contract | Document the exact fields produced per call: summary format, sentiment score range and labels, topic/tag format, issue resolution flag. Produce example JSON payloads. | None (sprint blocker — do first) | Documented contract with example JSON for stored call analytics and a clear definition of sentiment scoring rules. |
| **#20** | F5.2: Implement AI-based call summary generation | Build the summary generation module that takes a transcript and produces a concise summary. Use AWS Bedrock or a mocked NLP fallback for the MVP. | #19 (contract defines output format) | Working summary generator that produces output matching the contract for sample transcripts. |
| **#21** | F5.3: Generate call-level analytics | Build the analytics extraction pipeline: compute sentiment score, extract topics, identify issue tags from transcripts. This is the core transformation step. | #19 (schema), #20 (summaries feed into the analytics record) | Working analytics generator that produces structured analytics matching the defined schema for sample calls. |
| **#41** | F2.2: Detect negative sentiment during analytics processing | Add sentiment threshold evaluation during analytics generation. Flag calls as negative when score falls below the defined threshold. | #40 (threshold definitions), #21 (analytics generation) | Negative sentiment detection integrated into the analytics processing flow with verified threshold behavior. |

---

### Mujeeb — Database and API Lead

Mujeeb owns the storage foundation and the API surface: building the database helpers that the pipeline writes to, persisting historical records, and wiring the API endpoints that serve analytics to the frontend.

| # | Issue | Description | Dependencies | Deliverable |
|---|-------|-------------|--------------|-------------|
| **#105** | INF2.4: Add call analysis database helpers | Implement create, read, and update helpers for `call_analyses`, `call_analysis_topics`, and `call_analysis_keywords` tables. Support auto-creation of topics/keywords if they don't exist. | #19 (schema must be defined) | Tested DB helper module with functions for CRUD on call analyses and topic/keyword linking. |
| **#15** | F3.2: Persist historical analytics metrics | Implement storage for per-call or per-day analytics records that support trend analysis. Ensure records can be grouped by date range, agent, and team. | #14 (metric definitions), #105 (DB helpers) | Historical analytics records written and verified in Supabase with sample/seeded data. |
| **#60** | F5.5: Create call-level analytics API endpoint | Implement `GET /api/calls/{id}/analytics` returning summary and analytics fields for a single call. Handle missing or unprocessed calls. | #105 (DB helpers), #59 (data must be persisted) | Working endpoint returning analytics matching the documented contract, verified via curl/Postman. |
| **#47** | F3.4: Create historical analytics API endpoint | Implement `GET /api/analytics/trends` accepting time-range parameters and returning chart-friendly aggregated data. Handle empty or invalid ranges. | #16 (time-range query logic) | Working endpoint returning historical analytics, verified via curl/Postman. |

---

### Mildness — Persistence, Auth, and Endpoint Wiring

Mildness owns the write path for analytics and alerts, the authentication infrastructure, and one of the three core API endpoints.

| # | Issue | Description | Dependencies | Deliverable |
|---|-------|-------------|--------------|-------------|
| **#59** | F5.4: Persist call summaries and analytics | Wire the analytics generation output into the database. Ensure idempotent writes (reprocessing a call does not create duplicates). Link analytics to call records. | #19 (schema), #105 (DB helpers) | Analytics records persisted for sample calls, verified via DB query. Idempotent behavior demonstrated. |
| **#11** | F2.4: Persist alert records | Define alert storage schema and implement persistence for negative sentiment and recurring issue alerts. Handle duplicate prevention. | #40 (alert type definitions) | Alert records saved and retrievable, with duplicate handling verified. |
| **#77** | F9.3: Create agent performance API endpoint | Implement `GET /api/agent/performance` returning personal KPIs, weekly trend, and team comparison as documented in `dashboard-api-endpoints.md`. | #29 (agent query logic), #92 (auth for agent identity) | Working endpoint matching the documented contract, verified via curl/Postman with auth. |
| **#92** | Replace mock authentication with Supabase Auth integration | Remove mock auth. Implement backend auth endpoints (signup, signin, signout, me). Add middleware to protect analytics endpoints. Enforce team-scoped reads. | None (can start early; endpoint integration happens last) | Working Supabase Auth with protected backend routes. Unauthenticated requests return 401. |

---

### Fiyin — Architecture, Contracts, and Aggregation Lead

Fiyin owns the high-level contract definitions, the ingestion investigation, and the aggregation/query layer that computes the metrics both dashboard endpoints return.

| # | Issue | Description | Dependencies | Deliverable |
|---|-------|-------------|--------------|-------------|
| **#28** | F9.1: Define agent performance metrics and dashboard contract | Define agent-level metrics (sentiment trend, common topics, time-range support). Align with `GET /api/agent/performance` response shape in `dashboard-api-endpoints.md`. Produce example JSON. | None (sprint blocker — do first) | Documented agent performance contract with example JSON, metric calculation rules, and percentile/comparison logic. |
| **#128** | Investigate Call Ingestion Approaches for Analytics Pipeline | Research how call data (recordings or transcripts) will enter the analytics pipeline. Evaluate AWS Connect integration, transcript imports, and API-based ingestion. Recommend an MVP approach. | None (research task, parallel to everything) | Written document with viable ingestion approaches, trade-offs, and an MVP recommendation. |
| **#10** | F1.2: Implement dashboard metrics aggregation logic | Compute summary metrics from stored call analytics: avg sentiment, total calls, negative %, top topics, sentiment distribution, agent stats. Must match `GET /api/dashboard/metrics` response. | #15 (historical records), #16 (time-range queries) | Working aggregation function returning correct metrics for sample dataset, verified via test output. |
| **#29** | F9.2: Implement agent-level analytics query logic | Query call analytics scoped to a single agent. Aggregate sentiment over time, compute weekly trend, and derive team comparison percentiles. | #28 (contract), #15 (stored records) | Working agent query returning correct metrics for sample agent, verified via test output. |
| **#16** | F3.3: Implement time-range analytics query logic | Query stored analytics by start/end date. Aggregate by chosen granularity (daily/weekly). Return data in chart-friendly format. | #14 (metric definitions), #15 (persisted data) | Reusable time-range query module returning correct aggregations for sample date ranges. |

---

### Ini — Definitions, Specifications, and Frontend Analytics Shell

Ini owns the definition issues that establish the formal specs the rest of the team codes against, plus the frontend UI layout that will display call-level analytics.

| # | Issue | Description | Dependencies | Deliverable |
|---|-------|-------------|--------------|-------------|
| **#14** | F3.1: Define historical metrics and time granularity | Define which metrics are stored historically (sentiment avg, call count, negative rate, etc.), at what aggregation granularity (daily/weekly), and the expected query inputs (start date, end date). | None (sprint blocker — do first) | Documented metrics list, granularity rules, and example time-range query with expected output. |
| **#17** | F4.1: Define supported filters and search parameters | Define the filter and search interface: agent filter, sentiment range, keywords. Document query parameter format and expected response shape. | None (definition work) | Documented filter specs with example request/response payloads. |
| **#40** | F2.1: Define alert types and thresholds | Define alert categories (negative sentiment, recurring issue), triggering thresholds (e.g., sentiment < X, issue in N calls), and alert payload shape. | None (definition work) | Documented alert types, thresholds, and example alert JSON. |
| **#61** | F5.6: Build call-level analytics UI layout | Build the frontend UI section for displaying per-call analytics: summary, sentiment indicator, topic/issue tags. Use placeholder or mock data initially. | #19 (contract defines what to display) | UI rendering correctly with screenshot attached. Ready to wire to API in next sprint. |

---

## 6. Dependency Order

```
Phase 1 (Contracts — all parallel, unblocked)
├── #19  Define call analytics contract        ← SPRINT BLOCKER
├── #14  Define historical metrics             ← SPRINT BLOCKER
├── #28  Define agent performance contract     ← SPRINT BLOCKER
├── #40  Define alert types and thresholds
├── #17  Define filters and search parameters
└── #128 Investigate ingestion approaches

Phase 2 (Persistence — depends on contracts)
├── #105 Call analysis DB helpers              ← depends on #19
├── #59  Persist call summaries/analytics      ← depends on #19, #105
├── #15  Persist historical analytics          ← depends on #14, #105
└── #11  Persist alert records                 ← depends on #40

Phase 3 (Processing — depends on contracts + persistence)
├── #20  AI-based summary generation           ← depends on #19
├── #21  Generate call-level analytics         ← depends on #19, #20
└── #41  Detect negative sentiment             ← depends on #40, #21

Phase 4 (Aggregation — depends on persistence)
├── #16  Time-range analytics query logic      ← depends on #14, #15
├── #10  Dashboard metrics aggregation         ← depends on #15, #16
└── #29  Agent-level analytics query logic     ← depends on #28, #15

Phase 5 (Endpoints — depends on queries + auth)
├── #60  Call-level analytics API endpoint     ← depends on #105, #59
├── #47  Historical analytics API endpoint     ← depends on #16
└── #77  Agent performance API endpoint        ← depends on #29, #92

Phase 6 (Auth — parallel track, integrates with endpoints)
└── #92  Supabase Auth integration             ← independent start, endpoint integration last

Phase 7 (Frontend Shell — parallel track)
└── #61  Call analytics UI layout              ← depends on #19 (to know what to display)
```

**Critical path:**
`#19` → `#105` → `#59` → `#21` → `#10` → `#47`/`#60`

**Simplified flow:**
```
contracts → DB helpers → persistence → analytics generation → aggregation → API endpoints → auth protection
```

---

## 7. Risks and Dependencies

### Critical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Contract definitions delay** | Every implementation task depends on #19, #14, and #28. If these slip, the entire sprint stalls. | Time-box contract work to the first 2 days. Use the existing `dashboard-api-endpoints.md` and `datamodel-schema.md` as strong starting points — these are refinements, not blank-slate designs. |
| **Supabase Auth complexity (#92)** | Auth integration touches every protected endpoint. If it takes longer than expected, endpoint wiring is blocked. | Start auth work in parallel from day 1. Design endpoints to work without auth first (using a bypass flag for development), then add auth middleware as the final integration step. |
| **AI/NLP model availability** | Summary generation (#20) depends on an NLP model (AWS Bedrock). If access is not configured, processing work stalls. | Design #20 with a mocked fallback from the start. The contract (#19) defines the output shape — a rule-based or template-based fallback can satisfy the contract for demo purposes. |
| **Ingestion path undefined** | The pipeline has no defined input path yet. If #128 reveals blockers, the team may need to adjust how transcripts enter the system. | #128 is intentionally research. For this sprint, the pipeline can process pre-loaded/seeded transcripts. The ingestion investigation informs the next sprint. |

### Technical Dependencies

| Dependency | Owner | Consumers |
|------------|-------|-----------|
| Call analytics contract (#19) | Kiitan | Everyone (DB helpers, persistence, processing, endpoints, UI) |
| Historical metrics definition (#14) | Ini | Mujeeb (persistence), Fiyin (queries), Mujeeb (trends endpoint) |
| Agent performance contract (#28) | Fiyin | Mildness (endpoint), Fiyin (query logic) |
| DB helpers (#105) | Mujeeb | Mildness (persistence), Kiitan (processing writes), Mujeeb (endpoints) |
| Supabase Auth (#92) | Mildness | All endpoint owners (Mujeeb, Mildness) |

### Process Risks

| Risk | Mitigation |
|------|------------|
| Five people working on tightly coupled backend code → merge conflicts | Use the dependency phases as a natural sequencing guide. Contract work is documentation. Persistence and processing can be developed in separate modules. |
| Definition tasks produce ambiguous specs → implementation diverges | Each definition issue must produce concrete example JSON, not just prose descriptions. Review definitions as a team before implementation begins. |
| Sprint is backend-heavy → frontend team members may feel blocked | Ini has definition work from day 1 and UI layout work that can proceed with mock data. Definitions are high-value collaborative work, not filler. |

---

## 8. Definition of Done

This sprint is complete when all of the following are true:

### Contracts and Definitions
- [ ] Call-level analytics schema is documented with example JSON payloads (#19)
- [ ] Historical metrics, granularity, and query format are documented (#14)
- [ ] Agent performance response contract is documented and aligned with `dashboard-api-endpoints.md` (#28)
- [ ] Alert types, thresholds, and payload shape are documented (#40)
- [ ] Filter and search parameters are documented (#17)

### Persistence and Data Flow
- [ ] Call analysis DB helpers (CRUD + topic/keyword linking) are implemented and tested (#105)
- [ ] Call summaries and analytics are persisted to the database for sample calls (#59)
- [ ] Historical analytics metrics are stored and queryable by date range (#15)
- [ ] Alert records are persisted with duplicate prevention (#11)

### Analytics Processing
- [ ] AI-based summary generation produces output matching the contract for sample transcripts (#20)
- [ ] Call-level analytics (sentiment, topics, issue tags) are generated for sample calls (#21)
- [ ] Negative sentiment detection correctly flags calls below threshold (#41)

### Query and Aggregation
- [ ] Time-range query logic returns correct aggregations for sample date ranges (#16)
- [ ] Dashboard metrics aggregation returns values matching the `GET /api/dashboard/metrics` contract (#10)
- [ ] Agent-level query returns correct performance data for sample agents (#29)

### API Endpoints
- [ ] `GET /api/calls/{id}/analytics` returns real computed data (#60)
- [ ] `GET /api/analytics/trends` returns time-range analytics (#47)
- [ ] `GET /api/agent/performance` returns agent KPIs, trend, and team comparison (#77)

### Authentication
- [ ] Backend auth endpoints (signup, signin, signout, me) are functional via Supabase Auth (#92)
- [ ] Protected analytics endpoints reject unauthenticated requests with 401 (#92)

### Research and Frontend
- [ ] Call ingestion approach document is complete with MVP recommendation (#128)
- [ ] Call-level analytics UI layout renders with placeholder data (#61)

---

## 9. End-of-Sprint Demo

If the sprint is completed successfully, the team should be able to demo the following sequence:

### Demo Flow

1. **Input**: Show a sample call transcript stored in the `calls` table (pre-loaded or seeded).

2. **Processing**: Trigger analytics generation on the transcript. Show the system producing:
   - A concise AI-generated summary
   - A sentiment score and label (e.g., `0.34`, `negative`)
   - Extracted topics (e.g., `["billing", "refund"]`)
   - Issue resolution status

3. **Persistence**: Query the `call_analyses` table directly and show the generated analytics stored alongside linked topics and keywords.

4. **Negative Sentiment Detection**: Show that a call with a low sentiment score was automatically flagged, and an alert record was created in the `alerts` table.

5. **API — Call Analytics**: Hit `GET /api/calls/{id}/analytics` and show it returns the computed summary, sentiment, and topics for the processed call.

6. **API — Dashboard Metrics**: Hit `GET /api/dashboard/metrics?days=14` and show it returns aggregated team-level data: average sentiment, total calls, negative call percentage, top topics, sentiment distribution, and agent stats.

7. **API — Agent Performance**: Hit `GET /api/agent/performance` (authenticated as an agent) and show it returns the agent's personal KPIs, weekly sentiment trend, and anonymized team comparison percentiles.

8. **Authentication**: Show that hitting any analytics endpoint without a valid auth token returns a `401 Unauthorized` response.

9. **Frontend Shell**: Show the call-level analytics UI layout rendering with placeholder data, demonstrating the display surface that will wire to the API.

### Demo Summary Statement

> "We built the core analytics pipeline. A call transcript goes in, AI generates a summary with sentiment and topics, the results are persisted to Supabase, and three authenticated API endpoints serve that data to the supervisor dashboard and agent performance views. The frontend has a layout ready to consume it."

---

## Appendix: Assignment Summary

| Team Member | Role | Issues | Count |
|------------|------|--------|-------|
| **Kiitan** | Analytics Engine Lead | #19, #20, #21, #41 | 4 |
| **Mujeeb** | Database & API Lead | #105, #15, #60, #47 | 4 |
| **Mildness** | Persistence, Auth & Endpoint Wiring | #59, #11, #77, #92 | 4 |
| **Fiyin** | Architecture, Contracts & Aggregation | #28, #128, #10, #29, #16 | 5 |
| **Ini** | Definitions & Frontend Shell | #14, #17, #40, #61 | 4 |

**Total sprint issues: 21**
