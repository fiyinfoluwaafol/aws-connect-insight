# Core Call Analytics Execution Plan

This document turns the backend endpoint notes into a concrete team plan for getting the core call analytics pipeline working.

For this pass, "core call analytics pipeline working" means:

- completed calls can produce analytics data
- analytics data is persisted in a queryable form
- supervisor and agent dashboard endpoints can read real aggregated results
- protected routes are enforced with real auth

Out of scope for this pass:

- coaching tips
- exemplars
- notifications
- new GitHub issues that duplicate work already tracked in [`issues.csv`](/Users/fiyinfoluwaafolayan/Dev-Doings/aws-connect-insight/issues.csv)

## End State We Need

The team should be able to demo both documented dashboard endpoints against stored analytics data:

- `GET /api/dashboard/metrics`
- `GET /api/agent/performance`

The expected response shapes are already defined in [`dashboard-api-endpoints.md`](/Users/fiyinfoluwaafolayan/Dev-Doings/aws-connect-insight/docs/backend/dashboard-api-endpoints.md). The work below is about implementing the pipeline behind those contracts, not redefining them.

## Existing Issues That Already Cover This Work

### Core pipeline definition and processing

- `#19` `F5.1: Define call-level summary and analytics contract`
- `#21` `F5.3: Generate call-level analytics`
- `#59` `F5.4: Persist call summaries and analytics`
- `#105` `INF2.4: Add call analysis database helpers`

### Historical storage and aggregation

- `#14` `F3.1: Define historical metrics and time granularity`
- `#15` `F3.2: Persist historical analytics metrics`
- `#16` `F3.3: Implement time-range analytics query logic`
- `#10` `F1.2: Implement dashboard metrics aggregation logic`

### Endpoint-facing contracts and queries

- `#28` `F9.1: Define agent performance metrics and dashboard contract`
- `#29` `F9.2: Implement agent-level analytics query logic`
- `#47` `F3.4: Create historical analytics API endpoint`
- `#60` `F5.5: Create call-level analytics API endpoint`
- `#77` `F9.3: Create agent performance API endpoint`

### Auth and protected access

- `#92` `Replace mock authentication with Supabase Auth integration`

## Recommended Execution Order

This is the order the team should follow if the goal is to get the pipeline working with the least rework:

1. Lock the analytics data contracts and metric definitions: `#19`, `#14`, `#28`
2. Build persistence and DB helper support: `#105`, `#15`, `#59`
3. Implement call-level analytics generation against the agreed contract: `#21`
4. Implement reusable query and aggregation logic: `#16`, `#10`, `#29`
5. Enforce real auth on protected backend reads: `#92`
6. Wire the API endpoints to the shared logic: `#47`, `#60`, `#77`

The main dependency to respect is simple: contracts first, storage second, generation third, queries fourth, endpoints last.

## Team Workstreams

These workstreams are parallelizable once the contract decisions are made.

### Workstream 1: Analytics contract and metric definitions

**Issues:** `#19`, `#14`, `#28`

**What this group should deliver**

- one agreed call analytics payload shape for stored per-call data
- one agreed historical metric list and time granularity for rollups
- one agreed agent performance response contract aligned with [`dashboard-api-endpoints.md`](/Users/fiyinfoluwaafolayan/Dev-Doings/aws-connect-insight/docs/backend/dashboard-api-endpoints.md)
- explicit definitions for:
  - sentiment score and label
  - topic/tag format
  - negative call criteria
  - daily vs weekly rollups
  - percentile and team comparison rules

**Why this goes first**

The storage schema, aggregation code, and endpoint handlers will drift if these definitions stay implicit.

**What to report back to the team**

- final JSON examples for stored call analytics and both dashboard responses
- metric definitions that engineering can code against without interpretation
- any unresolved data-source gaps that block implementation

### Workstream 2: Persistence and ingestion

**Issues:** `#105`, `#15`, `#59`, `#21`

**What this group should deliver**

- DB helpers for reading and writing call analytics data
- schema support for persisted call-level analytics and historical queries
- the processing flow that turns completed calls or transcripts into normalized analytics records
- idempotent write behavior so reprocessing does not create duplicates

**Implementation focus**

- store the fields needed by both documented endpoints
- make records queryable by team, agent, and time range
- normalize sentiment/topics before persistence rather than inside endpoint code
- prove the write path with seeded or sample calls

**What to report back to the team**

- where analytics data lives
- what fields are persisted
- what triggers analytics generation
- what test or sample evidence shows records are being generated and stored correctly

### Workstream 3: Aggregation and query layer

**Issues:** `#16`, `#10`, `#29`

**What this group should deliver**

- reusable query logic for time-range analytics
- supervisor-level aggregation for `GET /api/dashboard/metrics`
- agent-level aggregation for `GET /api/agent/performance`
- consistent empty-state behavior for low-data or no-data cases

**Implementation focus**

- compute from persisted analytics data, not mocks
- share as much aggregation code as possible between supervisor and agent views
- support the documented `days` behavior for dashboard metrics
- return chart-friendly daily and weekly outputs

**What to report back to the team**

- which aggregations are shared vs endpoint-specific
- how percentile and team comparison are computed
- what query patterns are used and whether indexes/perf concerns showed up

### Workstream 4: Auth and endpoint wiring

**Issues:** `#92`, `#47`, `#60`, `#77`

**What this group should deliver**

- protected backend routes with real Supabase-backed auth
- team-scoped supervisor reads
- self-scoped agent reads plus allowed aggregate comparison fields
- working endpoint handlers for the documented contracts

**Implementation focus**

- do not ship analytics endpoints on top of mock auth
- enforce access control at the backend layer
- validate request params and return stable empty/error responses
- verify endpoint output matches [`dashboard-api-endpoints.md`](/Users/fiyinfoluwaafolayan/Dev-Doings/aws-connect-insight/docs/backend/dashboard-api-endpoints.md)

**What to report back to the team**

- how auth context reaches the analytics queries
- how team scoping is enforced
- example successful calls for both endpoints
- example unauthorized or invalid requests proving guards work

## Concrete Assignment Plan

If you want the cleanest split for the team right now, assign work like this:

1. Backend contract owner
   - Drive `#19`, `#14`, `#28`
   - Deliver the final payload definitions and calculation rules first
2. Data pipeline owner
   - Drive `#105`, `#15`, `#59`, `#21`
   - Deliver storage, helpers, and ingestion with sample persisted records
3. Analytics query owner
   - Drive `#16`, `#10`, `#29`
   - Deliver shared aggregation logic and prove outputs against seeded data
4. API/auth owner
   - Drive `#92`, `#47`, `#60`, `#77`
   - Deliver protected routes and final endpoint wiring

If the team is smaller, combine roles `2` and `3`. Do not combine `1` with downstream implementation until the contracts are settled.

## Immediate Next Team Check-In

At the next check-in, the team should be ready to answer these questions:

1. What is the exact stored shape for call analytics data?
2. Which fields are the source of truth for dashboard rollups?
3. How are `negative_call_percent`, `sentiment_distribution`, `weekly_trend`, and `percentile` computed?
4. Where is team scoping enforced for supervisor and agent reads?
5. Which of the tracked issues are blocked, and by what concrete dependency?

## What Not To Do

- Do not create new GitHub issues for dashboard metrics, agent performance, persistence, auth, or analytics generation if the work already maps to the issues above.
- Do not implement endpoint-specific business logic before the contracts in `#19`, `#14`, and `#28` are settled.
- Do not leave normalization rules implicit inside route handlers.
- Do not rely on mock auth for backend analytics endpoints if the goal is a real pipeline demo.

## Suggested Team Update

If you need a short update to send back to the team, use this:

> We already have the core analytics work tracked. The immediate focus is to finish contract definition (`#19`, `#14`, `#28`), then complete persistence and ingestion (`#105`, `#15`, `#59`, `#21`), then wire shared aggregation/query logic (`#16`, `#10`, `#29`), and only then finalize the protected endpoints (`#92`, `#47`, `#60`, `#77`). We should avoid creating duplicate issues and instead assign owners across those existing tickets.
