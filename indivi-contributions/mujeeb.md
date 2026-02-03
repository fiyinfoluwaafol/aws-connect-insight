# Technical Debt & Risk Analysis

This document summarizes individual contributions to the team's technical debt and risk analysis for the Amazon Connect Agent Supervisor Insights project.

### TD-03: Zero Automated Test Coverage

- **Category:** Test Debt
- **Summary:** No unit, integration, or E2E tests are configured, and no test tooling exists in the repo.
- **Evidence:**
- `package.json` has no `test` script
- No `*.test.*` or `*.spec.*` files
- No Vitest/Jest/Playwright dependencies
- **Impact:**
- Business logic changes are high-risk
- Regressions will slip to production without detection
- Manual QA becomes the only safety net
- **Severity:** Critical
- **Key actions:**
- Add Vitest + Testing Library with jsdom
- Write unit tests for `src/lib/` and `src/stores/`
- Add component and integration tests for critical flows
- Add E2E coverage for core supervisor/agent paths
- **Ticket:** "Set up Vitest and achieve 70% test coverage on core logic"

---

### TD-07: Missing Error Handling and Loading States

- **Category:** Architectural Debt
- **Summary:** Errors are often swallowed or only logged, and there are no error boundaries or consistent loading/error UI patterns.
- **Evidence:**
- `src/pages/supervisor/Briefs.tsx` falls back silently on PDF export
- `src/lib/mock-service.ts` logs errors to console only
- No Error Boundary component in the app
- **Impact:**
- Failures are invisible to users
- Debugging and support are harder in production
- App crashes can take down the full UI
- **Severity:** Medium
- **Key actions:**
- Add a global Error Boundary with fallback UI
- Standardize loading/error states in data views
- Surface errors via toast notifications with retry
- Add production error monitoring (Sentry/CloudWatch)
- **Ticket:** "Implement global error boundaries and consistent error handling patterns"
