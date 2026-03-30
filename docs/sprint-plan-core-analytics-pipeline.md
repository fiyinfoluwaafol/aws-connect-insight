# Sprint Plan: Core Call Analytics Pipeline

> **Status:** Team-refined — two tasks per person  
> **Updated:** 2026-03-30  
> **Based on:** Open issues from `issues.csv`, sprint direction from `core-call-analytics-endpoint-issues.md`, API contracts from `dashboard-api-endpoints.md`, and database schema from `datamodel-schema.md`

---

## 1. Sprint Goal

**Establish the analytics contracts and ingestion direction, implement call-analysis database access and summary generation, persist analytics to the database, protect the backend with Supabase Auth, and expose per-call analytics through a working API endpoint.**

This sprint is intentionally narrow: **two GitHub issues per person (10 issues total)**. Aggregation endpoints, full dashboard/agent performance APIs, alert detection, and UI wiring are deferred to follow-on work once this slice lands.

---

## 2. Why This Sprint

The product needs a real data path from transcripts to stored analytics and authenticated reads. This slice locks **what** is stored (#19, #14, #17, #28), **how** it gets in (#128), **how** it is written (#105, #59), **how** summaries are produced (#20), and **how** clients read it (#60, #92). Completing these issues unblocks the rest of the pipeline without overloading a single sprint.

---

## 3. Task Breakdown and Assignments

### Kiitan — Analytics contract and summary generation

| # | Issue | Short description | Dependencies | Expected deliverable |
|---|-------|-------------------|--------------|----------------------|
| **#19** | F5.1: Define call-level summary and analytics contract | Document fields, types, sentiment rules, topic/tag format, example JSON. Unblocks #105, #20, #59. | None (start here) | Written contract + example payloads the team can implement against. |
| **#20** | F5.2: Implement AI-based call summary generation | Implement summary generation from transcript text; match #19; use Bedrock or a documented mock path. | #19 | Runnable summary generation for sample transcripts with output matching the contract. |

---

### Mujeeb — Database helpers and call analytics API

| # | Issue | Short description | Dependencies | Expected deliverable |
|---|-------|-------------------|--------------|----------------------|
| **#105** | INF2.4: Add call analysis database helpers | Helpers for create/read/update of call analyses; link topics/keywords; auto-create topics/keywords as needed. | #19 (schema) | Tested helper module used by persistence and API layers. |
| **#60** | F5.5: Create call-level analytics API endpoint | Implement `GET /api/calls/{id}/analytics`; handle missing/unprocessed calls; align response with #19. | #105, #59 (data exists for demos) | Working endpoint verified with curl/Postman. |

---

### Fiyin — Ingestion research and agent performance contract

| # | Issue | Short description | Dependencies | Expected deliverable |
|---|-------|-------------------|--------------|----------------------|
| **#128** | Investigate Call Ingestion Approaches for Analytics Pipeline | Compare options (e.g. Connect, import, API); metadata needs; MVP recommendation. | None (parallel) | Short doc: options, trade-offs, recommended MVP path. |
| **#28** | F9.1: Define agent performance metrics and dashboard contract | Define KPIs, weekly trend, team comparison, time ranges; example JSON per `dashboard-api-endpoints.md`. | None (parallel with #128) | Documented contract + example `GET /api/agent/performance` response for future implementation. |

---

### Mildness — Auth and persisting analytics

| # | Issue | Short description | Dependencies | Expected deliverable |
|---|-------|-------------------|--------------|----------------------|
| **#92** | Replace mock authentication with Supabase Auth integration | Backend auth routes, session/token handling, middleware; no secrets in frontend. | Can start early | Sign up/in/out/me working; protected routes return 401 when unauthenticated. |
| **#59** | F5.4: Persist call summaries and analytics | Write pipeline output to DB via #105; idempotent upsert per call; link to `calls`. | #19, #105; integrates with #20 output | Persisted rows verifiable in DB for sample calls. |

---

### Ini — Pipeline specifications (not UI-only)

Ini’s issues are **specification and contract work** for the analytics pipeline: they define what gets stored over time (#14) and how search/filter APIs should behave (#17). This is core pipeline design—schemas, metrics lists, and request/response examples—not frontend implementation.

Optional **small add-ons** Ini can pick up if time allows (same issues, no new tickets): review #19/#28 for consistency, add a **cross-reference table** in the team doc (metric → table/field), or draft **example SQL** or query sketches that implement #14’s granularity—still within pipeline analytics, not a separate UI epic.

| # | Issue | Short description | Dependencies | Expected deliverable |
|---|-------|-------------------|--------------|----------------------|
| **#14** | F3.1: Define historical metrics and time granularity | List metrics for trends/rollups; daily vs weekly; inputs (date range); example outputs. | None (parallel) | Doc: metrics, granularity, example time-range query + expected shape. |
| **#17** | F4.1: Define supported filters and search parameters | Document filters (agent, sentiment, keywords), query params, pagination notes, response shape. | None (parallel) | Doc: filter/search contract with example request/response JSON. |

---

## 4. Dependency Order

```
Contracts & specs (parallel)
  #19 (Kiitan)     #14 (Ini)     #17 (Ini)     #28 (Fiyin)     #128 (Fiyin)

Implementation chain
  #19 → #105 (Mujeeb) → #20 (Kiitan) → #59 (Mildness) → #60 (Mujeeb)

Auth (parallel)
  #92 (Mildness) — integrate with #60 when routes are ready
```

**Simplified flow:**  
`#19` / `#14` / `#17` / `#28` / `#128` (definitions) → `#105` → `#20` → `#59` → `#60` with `#92` enabling protected access.

---

## 5. Risks and Dependencies

| Risk | Mitigation |
|------|------------|
| **#19 late** | Blocks #105, #20, #59, #60. Time-box #19; use `datamodel-schema.md` and `dashboard-api-endpoints.md` as anchors. |
| **#60 before #59** | Endpoint may return empty; acceptable for early integration if contract and helpers exist; full demo needs persisted rows. |
| **Auth (#92) vs API (#60)** | Implement #60 with a dev bypass if needed; require auth before calling the sprint “done” for production-minded demo. |
| **Scope creep** | Only the ten listed issues count for this sprint; everything else is next sprint. |

---

## 6. Definition of Done

- [ ] **#19** — Call-level summary + analytics contract documented with example JSON.  
- [ ] **#20** — Summary generation runs on sample transcripts and matches #19.  
- [ ] **#105** — Call analysis DB helpers implemented and covered by tests or manual verification.  
- [ ] **#60** — `GET /api/calls/{id}/analytics` returns data consistent with #19 for calls that have persisted analysis.  
- [ ] **#128** — Ingestion investigation doc with MVP recommendation.  
- [ ] **#28** — Agent performance contract documented with example response.  
- [ ] **#92** — Supabase Auth integrated; protected routes reject unauthenticated requests appropriately.  
- [ ] **#59** — Summaries and analytics persisted for sample calls; idempotent behavior described or demonstrated.  
- [ ] **#14** — Historical metrics and time granularity documented.  
- [ ] **#17** — Filter and search parameters documented with examples.  

---

## 7. End-of-Sprint Demo

**Realistic demo for this sprint:**

1. Show documents for **#14**, **#17**, **#19**, **#28**, and **#128** (contracts + ingestion recommendation).  
2. Run **summary generation (#20)** on a sample transcript and show output matching #19.  
3. Show **data in Supabase** from **#59** (via #105).  
4. Call **`GET /api/calls/{id}/analytics` (#60)** with auth (**#92**) and show JSON for a processed call.  

**Narrative:**  
> “We locked the analytics and API contracts, defined historical and search parameters for the next layer, chose an ingestion direction, generated AI summaries, persisted analyses, and exposed them through an authenticated per-call analytics endpoint.”

---
