# Technical Debt & Risk Inventory

This document captures the architectural audit for the current Lovable.dev-generated prototype, along with AI/system risks and backlog-ready issue drafts.

## Part 1: Technical Debt Audit

### 1) Hardcoded demo auth and client-side authorization
- **Category:** Architectural Debt
- **Description:** Authentication is mocked via static users and role checks only in the client, so access control is bypassable and there is no real identity boundary.
- **Remediation Plan:** Replace with real auth (e.g., Cognito/Supabase) and server-side authorization checks; store tokens in HTTP-only cookies; remove static user list.
- **Evidence:** `src/stores/auth-store.ts`, `src/pages/SignIn.tsx`, `src/components/ProtectedRoute.tsx`

### 2) Mock data as system of record and localStorage seeding
- **Category:** Architectural Debt
- **Description:** Core data flows depend on generated mock data and localStorage seeding, which won’t scale to multi-user or production persistence.
- **Remediation Plan:** Introduce a backend API, define DTOs, and move seeding to fixtures/migrations; deprecate localStorage as primary storage.
- **Evidence:** `src/lib/mock-data.ts`, `src/lib/seed.ts`, `src/stores/app-store.ts`

### 3) UI pages directly read/compute domain data without a service boundary
- **Category:** Architectural Debt
- **Description:** Pages reach into mockData and apply business rules inline, making it hard to swap in real APIs or enforce policies centrally.
- **Remediation Plan:** Add a data access layer (repositories/services) and move filtering/aggregation to API or shared domain services; restrict UI to view models.
- **Evidence:** `src/pages/supervisor/Alerts.tsx`, `src/pages/agent/Home.tsx`

### 4) “God” MockService mixing data, analytics, exports, and email
- **Category:** Architectural Debt
- **Description:** A single module handles search, alerts, PDF export, email, and analytics, which couples unrelated concerns and will be hard to replace with real services.
- **Remediation Plan:** Split into modules (callsService, alertsService, exportService, notificationsService) and move export/email to server/worker.
- **Evidence:** `src/lib/mock-service.ts`

### 5) No automated tests or test runner
- **Category:** Test Debt
- **Description:** There are no test files or test scripts; core flows (auth, routing, alerts, tips) aren’t validated.
- **Remediation Plan:** Add Vitest + React Testing Library; unit tests for stores/services; integration tests for routing/role gates.
- **Evidence:** `package.json` (no test script), repo lacks test files

### 6) Limited architectural documentation and requirement traceability
- **Category:** Documentation Debt
- **Description:** README describes features but lacks ADRs, data flow diagrams, API contracts, or traceability to requirements/AI prompts.
- **Remediation Plan:** Add `/docs` with ADRs, data model, API spec, trust boundaries, and requirement mapping.
- **Evidence:** `README.md`

## Part 2: AI & System Risk Assessment

### 1) Reliability/Hallucination Risk
- **Risk:** When mock coaching/tips or summaries are replaced by LLMs, there is no verification or confidence gating, so hallucinated insights could mislead supervisors.
- **Mitigation:** Add evaluation datasets, automated consistency checks, and human-in-the-loop review for AI outputs before surfacing in UI.
- **Evidence:** `src/lib/mock-service.ts` (future AI stand-ins)

### 2) Security & Ethics Risk
- **Risk:** Current auth is client-only and all data is stored in localStorage; once real call data is used, PII leakage and unauthorized access become critical risks.
- **Mitigation:** Server-side authz, encrypted storage, data retention policy enforcement, and redaction before any LLM processing.
- **Evidence:** `src/stores/auth-store.ts`, `src/stores/app-store.ts`

### 3) Dependency Risk
- **Risk:** The app is tightly coupled to Lovable/shadcn component structure and mock interfaces; changes in external AI APIs or export libraries could break core flows.
- **Mitigation:** Introduce adapters for external providers and contract tests for API changes.
- **Evidence:** `src/lib/mock-service.ts`, `package.json`

## Part 3: Backlog Integration (Issue Drafts)

Note: These drafts are ready to paste into GitHub Issues. Apply labels like `technical-debt` and `refactor`.

### Issue 1: Replace mock auth with real authentication + server-side authorization
- **Labels:** technical-debt, security
- **Acceptance Criteria:**
  1. Users authenticate via a real provider and sessions are validated server-side.
  2. Protected routes require a valid server-verified session and role.
  3. `MOCK_USERS` and demo sign-in are removed from production build.
  4. Security tests or checks verify role isolation.

### Issue 2: Introduce data access layer + remove direct mockData usage
- **Labels:** technical-debt, refactor
- **Acceptance Criteria:**
  1. All pages fetch via a typed service/repository layer (no direct `mockData` imports in pages).
  2. API DTOs are validated at boundaries (e.g., zod).
  3. MockService is split into domain modules or replaced with API calls.
  4. Seed logic is moved to fixtures/migrations, not localStorage.

### Issue 3: Add automated test harness for stores, routing, and key user flows
- **Labels:** technical-debt, test
- **Acceptance Criteria:**
  1. `npm run test` (or equivalent) exists and passes.
  2. Unit tests cover auth store, alerts filtering, and tips generation.
  3. Integration tests cover ProtectedRoute for both roles.
  4. CI runs tests on PRs.
