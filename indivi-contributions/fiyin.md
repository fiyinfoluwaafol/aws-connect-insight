# Technical Debt & Risk Analysis

This document summarizes individual contributions to the team's technical debt and risk analysis for the Amazon Connect Agent Supervisor Insights project.

### TD-01: Mock-Only Data Layer with No Backend Integration Path

- **Category:** Architectural Debt
- **Summary:** UI is tightly coupled to mock data and `MockService` with no API abstraction or real schemas, blocking backend integration.
- **Evidence:**
- `src/lib/mock-service.ts` uses hardcoded delays and in-memory filtering
- `src/pages/agent/Performance.tsx` calls `MockService` directly
- `src/lib/mock-data.ts` defines guessed data types
- **Impact:**
- Real API integration requires major refactor
- Frontend and backend cannot develop against a stable contract
- Mock latency and error behavior hides production failure modes
- **Severity:** Critical
- **Key actions:**
- Define service interfaces (`ICallService`, `IAlertService`, `IBriefService`)
- Implement mock and API adapters behind those interfaces
- Align types to AWS Connect schemas
- Introduce a data fetching layer (e.g., React Query)
- **Ticket:** "Abstract data layer with service interfaces for backend integration"

---

### TD-06: Inadequate Production and Architecture Documentation

- **Category:** Documentation Debt
- **Summary:** There is no production deployment, architecture, or business-rule documentation; AI-generated vs hand-written code is not tracked.
- **Evidence:**
- No `docs/`, `ARCHITECTURE.md`, or `DEPLOYMENT.md`
- `README.md` only covers demo/mock auth
- Business-rule thresholds live in code without rationale
- **Impact:**
- Onboarding and ops are blocked without developer help
- Business rules are opaque and hard to validate
- Requirements traceability is missing
- **Severity:** Medium
- **Key actions:**
- Add `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/BUSINESS_RULES.md`
- Create ADRs and requirements traceability mapping
- Document code provenance for AI-generated sections
- **Ticket:** "Create production deployment, architecture, and requirements traceability documentation"

---

### R-03: Vendor Lock-in and Platform Dependencies

- **Area:** Dependency Risk
- **Summary:** Heavy reliance on Lovable.dev, AWS services, and Radix/shadcn UI increases migration cost and upgrade risk.
- **Evidence:**
- `package.json` includes `lovable-tagger` and many `@radix-ui/*`
- `vite.config.ts` enables Lovable dev tooling
- `src/components/ui/` contains many shadcn components
- **Impact:**
- Switching providers or UI stacks is costly
- Dependency upgrades can cause wide regressions
- External API outages can degrade UX
- **Likelihood:** Medium
- **Severity:** Medium
- **Key controls:**
- Introduce adapter interfaces for NLP and storage
- Document and isolate Lovable-specific patterns
- Pin dependencies and test upgrades in isolation
- Add resilience patterns (timeouts, retries, fallbacks)
- **Trust boundary:** Architectural/provider changes require review
