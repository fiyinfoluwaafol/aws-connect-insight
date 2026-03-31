# Sprint Plan: Core Analytics Pipeline

> **Status:** Draft
> **Updated:** 2026-03-31
> **Sources:** [`core-call-analytics-endpoint-issues.md`](./backend/core-call-analytics-endpoint-issues.md), [`issues.csv`](../issues.csv), [`dashboard-api-endpoints.md`](./backend/dashboard-api-endpoints.md)

## Sprint Goal

Ship the core call analytics pipeline end to end so the team can demo live analytics data flowing from stored backend records into the supervisor experience instead of mocks.

By the end of this sprint, the team should be able to show:

- sample calls or transcripts producing persisted analytics records
- supervisor metrics and historical trends computed from stored analytics
- working backend endpoints for call-level, historical, and agent-performance reads
- supervisor dashboard wiring using live backend analytics data
- a documented MVP recommendation for how real calls will enter the pipeline
- basic agent-side wiring only if the supervisor path is already stable

## Closed Prerequisites

The alignment doc dependencies `#14`, `#19`, `#28`, `#92`, and `#105` are already closed. This sprint builds on those decisions instead of reopening them.

## Scope For This Sprint

### Core Scope

- `#128` `F5.9: Investigate Call Ingestion Approaches for Analytics Pipeline`
- `#21` `F5.3: Generate call-level analytics`
- `#59` `F5.4: Persist call summaries and analytics`
- `#15` `F3.2: Persist historical analytics metrics`
- `#16` `F3.3: Implement time-range analytics query logic`
- `#10` `F1.2: Implement dashboard metrics aggregation logic`
- `#47` `F3.4: Create historical analytics API endpoint`
- `#29` `F9.2: Implement agent-level analytics query logic`
- `#60` `F5.5: Create call-level analytics API endpoint`
- `#77` `F9.3: Create agent performance API endpoint`
- `#36` `F1.4: Create dashboard metrics UI layout`
- `#37` `F1.5: Connect dashboard UI to metrics API`
- `#38` `F1.6: Add basic error & loading states`
- `#48` `F3.5: Build trend charts UI layout`
- `#49` `F3.6: Connect trend charts to analytics API`
- `#50` `F3.7: Add loading and empty-state handling`
- `#61` `F5.6: Build call-level analytics UI layout`
- `#62` `F5.7: Connect call analytics UI to backend API`
- `#63` `F5.8: Add loading, empty, and error states`

### Out Of Scope

- coaching tips
- exemplars
- notifications
- creating duplicate issues for work already covered above

### If Time Permits

- `#78` `F9.4: Build agent performance dashboard UI layout`
- `#79` `F9.5: Connect agent dashboard UI to backend API`
- `#80` `F9.6: Add loading, empty, and error states`

## Execution Order

The team should execute in this order to avoid rework:

1. Decide MVP ingestion direction in `#128`.
2. Generate and persist call-level analytics in `#21` and `#59`.
3. Persist and query historical data in `#15` and `#16`.
4. Build supervisor and agent aggregation logic in `#10` and `#29`.
5. Wire backend endpoints in `#60`, `#47`, and `#77`.
6. Wire the supervisor UI to live metrics, trends, and call analytics using `#36` to `#63`.
7. If the supervisor path is stable, wire the basic agent performance UI with `#78` to `#80`.
8. Run an end-to-end demo using seeded or sample calls.

## Team Assignments

This is the recommended sprint split for the current team. If GitHub assignees do not match this plan, update the issues to reflect sprint ownership.

| Team member | Primary ownership | Issues | Sprint deliverable |
| --- | --- | --- | --- |
| `fiyinfoluwaafol` | Sprint coordination, ingestion direction, supervisor API wiring | `#128`, `#10`, `#37`, `#49`, `#62` | MVP ingestion recommendation plus live supervisor screens for dashboard metrics, trends, and call analytics |
| `Mikito-Coder` | Call-level analytics generation and call analytics API | `#21`, `#60` | Structured analytics generated from transcripts and a working call-level analytics endpoint |
| `lawal-mj` | Historical storage, time-range queries, trends endpoint | `#15`, `#16`, `#47` | Historical analytics persisted, queryable by range, and exposed through a backend trends endpoint |
| `Mildness10` | Persistence path and agent analytics | `#59`, `#29`, `#77` | Call analytics persisted for reuse and agent performance query plus endpoint working from stored data |
| `iniayolawal` | Supervisor UI layouts and frontend states | `#36`, `#38`, `#48`, `#50`, `#61`, `#63` | Dashboard, trends, and call analytics screens ready for live wiring with stable loading and empty states |

## If Time Permits

Once the core backend path and supervisor wiring are stable:

- `iniayolawal` takes `#78` and `#80` for the basic agent performance UI layout and states
- `fiyinfoluwaafol` takes `#79` to connect the agent dashboard to the backend
- `Mildness10` closes the loop by pairing `#79` against the live output from `#77`

## Workstream Details

### 1. Ingestion And Sprint Coordination

**Owner:** `fiyinfoluwaafol`  
**Issues:** `#128`, `#10`, `#37`, `#49`, `#62`

**Responsibilities**

- document the recommended MVP path for getting real call data into the backend
- define what minimum metadata the rest of the pipeline can rely on
- implement dashboard metrics aggregation once the historical query path is stable
- wire supervisor metrics, trend charts, and call analytics screens to live APIs

**Done when**

- the team has one agreed ingestion recommendation
- the required metadata list is explicit
- dashboard metrics compute correctly from stored analytics for a sample dataset
- the supervisor frontend is reading live backend analytics instead of mocks

### 2. Call Analytics Generation Path

**Owner:** `Mikito-Coder`  
**Issues:** `#21`, `#60`

**Responsibilities**

- turn transcripts into structured analytics fields the backend can store and query
- align output with the response shapes already documented in [`dashboard-api-endpoints.md`](./backend/dashboard-api-endpoints.md)
- expose per-call analytics through a backend endpoint that handles missing or unprocessed calls cleanly

**Done when**

- sample calls generate stable analytics payloads
- the call analytics endpoint returns expected fields for processed calls
- the endpoint has clear behavior for missing data

### 3. Historical Storage And Supervisor Trends

**Owner:** `lawal-mj`  
**Issues:** `#15`, `#16`, `#47`

**Responsibilities**

- persist analytics in a form that supports time-based grouping
- implement reusable time-range query logic for daily or weekly chart outputs
- expose historical analytics to the backend consumer through a trends endpoint

**Done when**

- historical records can be grouped by date range
- sample queries return chart-friendly data
- the trends endpoint works for valid ranges and fails cleanly for invalid ones

### 4. Persistence And Agent Performance

**Owner:** `Mildness10`  
**Issues:** `#59`, `#29`, `#77`

**Responsibilities**

- persist per-call summaries and analytics without unnecessary regeneration
- implement agent-scoped analytics queries from stored data
- expose agent performance through a backend endpoint with correct empty-state handling

**Done when**

- stored analytics are retrievable by call ID
- agent metrics compute correctly for a sample agent
- the agent performance endpoint returns live backend data rather than mocks

### 5. Supervisor UI Layouts And States

**Owner:** `iniayolawal`  
**Issues:** `#36`, `#38`, `#48`, `#50`, `#61`, `#63`

**Responsibilities**

- build the supervisor-facing layouts for dashboard metrics, trend charts, and call analytics
- provide loading, empty, and basic error states that make live wiring safe for demos
- keep the frontend ready for API connection work without waiting on final backend polish

**Done when**

- the supervisor screens render the required sections cleanly
- the UI handles loading and no-data cases without breaking
- the screens are ready for `#37`, `#49`, and `#62` to swap in live data

## Dependency Map

```text
Implementation path
  #128
  #21 -> #59
  #59 -> #15 -> #16
  #16 -> #10 and #29
  #59 -> #60
  #16 -> #47
  #10 -> #37
  #47 -> #49
  #60 -> #62
  #36 -> #37
  #48 -> #49
  #61 -> #62
  #38 after #37
  #50 after #49
  #63 after #62
  #29 -> #77
  optional: #77 -> #79
  optional: #78 -> #79 -> #80
```

## End-Of-Sprint Demo

The sprint is successful if the team can run one demo flow end to end:

1. Show the MVP ingestion recommendation from `#128`.
2. Process a sample transcript or seeded call through `#21`.
3. Show persisted analytics data from `#59` and historical persistence from `#15`.
4. Call the historical trends endpoint from `#47`.
5. Call the call-level analytics endpoint from `#60`.
6. Call the agent performance endpoint from `#77`.
7. Show the supervisor dashboard using live data through `#37`, `#49`, and `#62`.
8. If time permits, show the basic agent performance screen wired through `#78`, `#79`, and `#80`.
