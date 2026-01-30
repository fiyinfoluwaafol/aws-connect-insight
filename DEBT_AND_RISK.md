# Risk & Technical Debt Inventory

## Context

This document presents the consolidated technical debt and risk assessment for the Amazon Connect Agent Supervisor Insights application as it transitions from a Lovable.dev-generated prototype to a production-ready system. The application functions as a **system orchestrator** for contact center supervisors and agents, aggregating call data, sentiment analysis, alerts, and AI-powered coaching recommendations. This audit follows the **VIBE** principles—**V**erify current state, **I**mprove identified gaps, **B**uild sustainable foundations, and **E**xecute prioritized remediation—to create an actionable roadmap for production readiness.

---

## Repo Snapshot

### Stack Summary

| Layer | Technology |
|-------|------------|
| **Framework** | React 18.3.1 with Vite 5.4.19 |
| **Language** | TypeScript 5.8.3 (strict mode disabled) |
| **Styling** | Tailwind CSS 3.4.17 + shadcn/ui components |
| **State Management** | Zustand 5.0.9 with localStorage persistence |
| **Routing** | React Router DOM 6.30.1 |
| **Charts** | Recharts 2.15.4 |
| **PDF Export** | jsPDF 3.0.4 + html2canvas 1.4.1 |
| **Form Handling** | React Hook Form 7.61.1 + Zod 3.25.76 |
| **Build Tool** | Vite with SWC compiler |
| **Package Manager** | npm / bun |

### High-Level Architecture (Inferred)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client-Side Only)                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Supervisor UI  │  │    Agent UI     │  │   Shared Components │ │
│  │  - Overview     │  │  - Home         │  │   - AppHeader       │ │
│  │  - Alerts       │  │  - Performance  │  │   - ProtectedRoute  │ │
│  │  - Search       │  │  - Exemplars    │  │   - CallDetailDrawer│ │
│  │  - Briefs       │  │  - Notifications│  │   - StatCard        │ │
│  │  - Settings     │  │                 │  │   - SentimentBadge  │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                    │                      │            │
│           └────────────────────┼──────────────────────┘            │
│                                ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Zustand Stores                            │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ │   │
│  │  │   auth-store.ts  │  │         app-store.ts             │ │   │
│  │  │  - user session  │  │  - alerts, briefs, tips, notes   │ │   │
│  │  │  - role (mock)   │  │  - exemplars, bookmarks, settings│ │   │
│  │  └──────────────────┘  └──────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Mock Data Layer                           │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ │   │
│  │  │  mock-data.ts    │  │        mock-service.ts           │ │   │
│  │  │  - 300 calls     │  │  - searchCalls, generateBrief    │ │   │
│  │  │  - 12 agents     │  │  - exportCSV/PDF, coaching tips  │ │   │
│  │  │  - 25 alerts     │  │  - email mock, agent performance │ │   │
│  │  └──────────────────┘  └──────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│                         localStorage                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Environment/Config Overview

| Aspect | Current State | Status |
|--------|---------------|--------|
| **Environment Variables** | None used; no `.env` files, no `import.meta.env` usage | Warning |
| **Secrets Handling** | Slack webhook stored in localStorage via Zustand | Critical |
| **Build Modes** | `dev`, `build`, `build:dev` scripts exist | OK |
| **Feature Flags** | `lovable-tagger` conditionally loaded in dev mode | Warning |

### Testing/CI Status

| Aspect | Status |
|--------|--------|
| **Unit Tests** | None (no `*.test.*` or `*.spec.*` files) |
| **Integration Tests** | None |
| **E2E Tests** | None |
| **Test Framework** | Not configured (no Jest/Vitest) |
| **CI/CD Pipeline** | None (no `.github/workflows` directory) |
| **Deployment** | Manual; no Vercel/Netlify config files |
| **Linting** | ESLint configured but `@typescript-eslint/no-unused-vars: "off"` |

---

## Part 1 — Technical Debt Audit

### TD-01: Mock-Only Data Layer with No Backend Integration Path

- **Category:** Architectural Debt
- **Description:** The entire application operates on client-side mock data with no abstraction layer for backend integration. The `MockService` class directly manipulates in-memory arrays and Zustand stores, with hardcoded delays to simulate network latency. Components directly import `mockData` and `MockService`, coupling UI to mock implementations. There is no HTTP client, no API configuration, and no service interface that would allow swapping mock for real implementations.
- **Evidence:**
  - `src/lib/mock-data.ts` line 121 — Generates 300 calls at module load: `const mockCalls = generateCalls(300);`
  - `src/lib/mock-service.ts` lines 30-31 — Hardcoded delay simulation: `await delay(200 + Math.random() * 200);`
  - `src/lib/mock-service.ts` line 35 — Direct mock data filtering: `let filtered = mockData.calls.filter((call) => {...`
  - `src/lib/mock-service.ts` lines 83-84 — Store mutation from service: `const storeAlerts = useAppStore.getState().alerts;`
- **Impact:**
  - Cannot connect to real Amazon Connect APIs without rewriting the data layer
  - Business logic (filtering, pagination, analytics) duplicated in mock layer must be reimplemented
  - Frontend and backend teams cannot work independently; no contract-based development possible
  - Performance characteristics of mock delays don't represent real API latency or failure modes
- **Severity:** Critical
- **Remediation Plan:**
  1. Define TypeScript interfaces for all API contracts (`ICallService`, `IAlertService`, `IBriefService`)
  2. Create abstract service interfaces with methods matching current MockService signatures
  3. Refactor `MockService` into `MockCallService`, `MockAlertService` implementations
  4. Create `ApiCallService` stubs for AWS Connect integration
  5. Use React Context or dependency injection to swap implementations based on environment
  6. Integrate `@tanstack/react-query` (already in dependencies) for data fetching, caching, and error handling
  7. **Target end-state:** All data access through typed interfaces; mock and API implementations interchangeable
- **Suggested Backlog Ticket Title:** "Abstract data layer with service interfaces for backend integration"

---

### TD-02: Client-Side Mock Authentication with No Security Foundation

- **Category:** Architectural Debt
- **Description:** Authentication is implemented as a client-side mock with hardcoded user credentials visible in source code. Session state persists to unencrypted localStorage without expiration or token validation. The `ProtectedRoute` component only checks for presence of a user object in the store—there is no CSRF protection, no session timeout, and no server-side validation. The Slack webhook URL is also stored in localStorage, exposing integration credentials.
- **Evidence:**
  - `src/stores/auth-store.ts` lines 15-21 — Hardcoded mock users:
    ```typescript
    export const MOCK_USERS: User[] = [
      { id: 'sup-1', email: 'supervisor.ada@demo.com', name: 'Ada', role: 'supervisor', team: 'East' },
      { id: 'agent-1', email: 'agent.jordan@demo.com', name: 'Jordan', role: 'agent', agentId: 'a1' },
    ];
    ```
  - `src/stores/auth-store.ts` line 37 — Unencrypted localStorage: `name: 'auth-storage'`
  - `src/components/ProtectedRoute.tsx` lines 14-16 — Client-only check: `if (!user) { return <Navigate to="/signin" ... /> }`
  - `src/stores/app-store.ts` lines 53, 100-105 — Slack webhook in settings stored to localStorage
- **Impact:**
  - Any user can impersonate any role by modifying localStorage in browser DevTools
  - No protection against session hijacking, CSRF, or replay attacks
  - Contact center data often contains PII/PHI; HIPAA, SOC 2, and GDPR require proper authentication
  - Sessions never expire; no refresh token rotation; no logout propagation across tabs
  - Slack webhook exposed enables potential abuse
- **Severity:** Critical
- **Remediation Plan:**
  1. Integrate AWS Cognito (aligns with Amazon Connect ecosystem) or Auth0 for production authentication
  2. Implement JWT-based authentication with access/refresh token rotation
  3. Store tokens in httpOnly cookies, not localStorage
  4. Add automatic session timeout (15-30 minutes of inactivity for contact center compliance)
  5. Design RBAC permission matrix for roles: Admin, Supervisor, Team Lead, Agent
  6. Move Slack webhook to server-side environment variables
  7. Add audit logging for authentication events (login, logout, failed attempts)
  8. **Target end-state:** Server-validated sessions with role-based access control; no secrets in client storage
- **Suggested Backlog Ticket Title:** "Replace mock auth with AWS Cognito and server-side session management"

---

### TD-03: Zero Automated Test Coverage

- **Category:** Test Debt
- **Description:** The repository contains no automated tests—no unit tests, integration tests, or end-to-end tests. There is no test runner configured (Jest, Vitest, Playwright, Cypress) and no test-related dependencies in `package.json`. The application includes complex business logic in sentiment calculations, alert generation, search filtering, and coaching tip rules that remain unvalidated.
- **Evidence:**
  - `package.json` lines 6-11 — No test script defined:
    ```json
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "lint": "eslint .",
      "preview": "vite preview"
    }
    ```
  - No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files exist in repository
  - No `jest.config.*`, `vitest.config.*`, or test configuration files
  - No `@testing-library/*`, `jest`, `vitest`, `cypress`, or `playwright` in dependencies
- **Impact:**
  - Cannot verify correctness of business logic (sentiment thresholds, alert rules, coaching tip generation)
  - Refactoring is high-risk without regression safety net
  - No confidence in deployments; manual QA required for every change
  - Compliance requirements for healthcare/financial contact centers may mandate documented test coverage
- **Severity:** Critical
- **Remediation Plan:**
  1. Install Vitest (Vite-native): `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom`
  2. Create `vitest.config.ts` with React plugin and jsdom environment
  3. Add `"test": "vitest"` script to package.json
  4. Write unit tests for critical business logic:
     - `mock-service.ts`: `searchCalls`, `generatePostCallTips`, `generateDailyBrief`
     - `auth-store.ts`: `signIn`, `signOut`
     - `app-store.ts`: alert updates, settings mutations
  5. Write integration tests for `ProtectedRoute` role-based redirect logic
  6. **Target end-state:** 70%+ coverage on `src/lib/` and `src/stores/`; `npm test` passes in CI
- **Suggested Backlog Ticket Title:** "Set up Vitest and achieve 70% test coverage on core logic"

---

### TD-04: TypeScript Strict Mode Disabled

- **Category:** Architectural Debt
- **Description:** TypeScript's strict checking is comprehensively disabled across the project, allowing implicit `any` types, unchecked null access, and unused variables. This undermines the primary benefit of using TypeScript and will cause runtime errors in production that could have been caught at compile time.
- **Evidence:**
  - `tsconfig.json` lines 9-14:
    ```json
    "noImplicitAny": false,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "allowJs": true,
    "noUnusedLocals": false,
    "strictNullChecks": false
    ```
  - `tsconfig.app.json` lines 17-22:
    ```json
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false,
    "noFallthroughCasesInSwitch": false
    ```
  - `eslint.config.js` line 23: `"@typescript-eslint/no-unused-vars": "off"`
- **Impact:**
  - Null pointer exceptions at runtime (e.g., accessing `user.agentId` without null checks)
  - Dead code accumulates undetected
  - Refactoring is dangerous without type safety net
  - New team members may introduce bugs due to lenient type checking
- **Severity:** High
- **Remediation Plan:**
  1. Enable `strictNullChecks` first (highest impact, catches null access)
  2. Fix resulting type errors (estimate: 50-100 fixes across codebase)
  3. Enable `noImplicitAny` and add explicit types where needed
  4. Enable `strict: true` in `tsconfig.app.json` for full type safety
  5. Re-enable `@typescript-eslint/no-unused-vars` in ESLint
  6. Add pre-commit hook to prevent regression
  7. **Target end-state:** `strict: true` enabled; zero type errors; unused code removed
- **Suggested Backlog Ticket Title:** "Enable TypeScript strict mode and fix type errors"

---

### TD-05: Missing CI/CD Pipeline and Quality Gates

- **Category:** Architectural Debt
- **Description:** No continuous integration or deployment configuration exists. There are no GitHub Actions workflows, no Vercel/Netlify deployment configs, and no automated quality checks on pull requests. Linting, building, and (future) testing must be run manually, with no enforcement before merge.
- **Evidence:**
  - No `.github/workflows/` directory in repository
  - No `vercel.json`, `netlify.toml`, or similar deployment configuration
  - No `.gitlab-ci.yml`, `Jenkinsfile`, or other CI config
  - `package.json` only defines `dev`, `build`, `lint`, `preview` scripts—no `test` or `ci` script
- **Impact:**
  - Broken builds can be merged to main branch
  - No automated deployment process; manual builds required
  - Team relies on manual discipline for code quality
  - Cannot enforce branch protection rules effectively
- **Severity:** Medium
- **Remediation Plan:**
  1. Create `.github/workflows/ci.yml` with jobs for:
     - Lint: `npm run lint`
     - Build: `npm run build`
     - Test: `npm test` (after TD-03 complete)
  2. Configure branch protection on `main` requiring CI pass
  3. Add Vercel preview deployments for PRs
  4. Add production deployment workflow with manual approval gate
  5. **Target end-state:** All PRs require passing CI; automated preview and production deployments
- **Suggested Backlog Ticket Title:** "Implement GitHub Actions CI/CD pipeline with branch protection"

---

### TD-06: Inadequate Production and Architecture Documentation

- **Category:** Documentation Debt
- **Description:** While the README documents demo features comprehensively, it lacks critical documentation for production deployment, architecture decisions, and API contracts. There are no ADRs (Architecture Decision Records), no deployment runbooks, no documentation of AWS Connect integration points, and no explanation of business logic thresholds used in coaching tip generation.
- **Evidence:**
  - `README.md` lines 74-76 — Documents mock auth but not production requirements:
    ```markdown
    ## Mock Authentication
    The app uses mock authentication with pre-defined demo users
    ```
  - No `docs/` directory exists
  - No `ARCHITECTURE.md`, `CONTRIBUTING.md`, or `DEPLOYMENT.md`
  - `src/lib/mock-service.ts` lines 265-273 — Undocumented business rule thresholds:
    ```typescript
    if (call.sentimentScore < -0.3) {
      tips.push('Try acknowledging the customer\'s frustration earlier');
    }
    if (call.durationSec > 900) {
      tips.push('Consider summarizing the issue earlier');
    }
    ```
  - No environment variable documentation; no mention of required secrets
- **Impact:**
  - New team members cannot understand production requirements
  - Operations team cannot deploy without developer assistance
  - Coaching tip thresholds (-0.3 sentiment, 900 second duration) are arbitrary with no documented rationale
  - AWS Connect integration requirements unclear; no API contract documentation
- **Severity:** Medium
- **Remediation Plan:**
  1. Create `docs/ARCHITECTURE.md` documenting component hierarchy, data flow, and state management
  2. Create `docs/DEPLOYMENT.md` with environment variables, build steps, and infrastructure requirements
  3. Create `docs/BUSINESS_RULES.md` documenting all thresholds and their rationale
  4. Create `docs/ADR/` directory with initial decisions (Zustand choice, mock-first approach)
  5. Add inline JSDoc comments to all business logic functions in `mock-service.ts`
  6. **Target end-state:** New developer can deploy to production using docs alone; all thresholds documented
- **Suggested Backlog Ticket Title:** "Create production deployment and architecture documentation"

---

## Part 2 — AI & System Risk Assessment

### R-01: AI Hallucination in Call Summaries and Coaching Recommendations

- **Area:** Reliability/Hallucination
- **Description:** The application presents features as AI-powered ("AI Summary", "Coaching Tips") but currently implements them with deterministic rule-based logic and templated responses. When real LLM integration occurs (Amazon Bedrock), the system will face hallucination risks: summaries may fabricate call details, sentiment explanations may misattribute causes, and coaching tips may suggest approaches that violate company policy. Additionally, model updates from providers can silently change output behavior, causing calibrated thresholds to become misaligned.
- **Evidence:**
  - `src/lib/mock-service.ts` lines 261-293 — Rule-based tip generation (not AI):
    ```typescript
    if (call.sentimentScore < -0.3) {
      tips.push('Try acknowledging the customer\'s frustration earlier');
    }
    if (call.durationSec > 900) {
      tips.push('Consider summarizing the issue earlier');
    }
    ```
  - `src/lib/mock-data.ts` lines 146-150 — Templated summaries (not AI):
    ```typescript
    const summaries = {
      negative: `Customer called regarding delayed refund...`,
      positive: `Customer contacted for ${call.topics[0]} assistance...`,
    };
    ```
  - No OpenAI, Anthropic, AWS Comprehend, or Bedrock SDK in `package.json`
- **Impact:**
  - **Employment liability:** Inaccurate coaching feedback could lead to unfair evaluations or wrongful termination
  - **Customer commitments:** Fabricated summary details could cause agents to believe they made promises they didn't
  - **Supervisor trust erosion:** Unreliable AI outputs will cause supervisors to abandon the tool
  - **Threshold drift:** Model updates could shift sentiment distributions, miscalibrating alert volumes
- **Likelihood:** High (will occur when AI integration happens)
- **Severity:** High
- **Mitigations / Controls:**
  1. Display confidence scores alongside all AI-generated content; hide or flag low-confidence outputs
  2. Use retrieval-augmented generation (RAG) to ground summaries in specific transcript segments
  3. Implement schema validation for AI responses; reject outputs that don't match expected structure
  4. Pin model versions in Bedrock API calls; test outputs before upgrading
  5. Maintain golden dataset of calls with known-good outputs for regression testing
  6. Add "This seems wrong" feedback button to detect model degradation
  7. Log all AI-generated content with model version and prompt for compliance audit
- **Trust Boundary / Human-in-the-Loop:**
  - **Mandatory Review:** AI-generated coaching tips must be reviewed by supervisors before sharing with agents
  - **Cannot Automate:** Call summaries should not auto-populate customer records without human verification
  - **Audit Trail:** All AI outputs logged with version info; modifications tracked for compliance

---

### R-02: Insecure Authentication and Unvalidated User Input

- **Area:** Security & Ethics
- **Description:** The current authentication system is client-side only with no real security. Beyond the authentication gaps (covered in TD-02), user-generated content (call notes, alert keywords, Slack webhooks) is stored and rendered without validation or sanitization. While React provides some XSS protection, the lack of input validation creates risks for injection attacks when a backend is added, localStorage poisoning, and potential for malicious content in exported PDFs/CSVs. Prompt injection risks also emerge when user content is fed to AI systems.
- **Evidence:**
  - `src/stores/auth-store.ts` lines 15-21 — Hardcoded credentials in source code
  - `src/components/ProtectedRoute.tsx` — Client-side only role check, bypassable via DevTools
  - `src/stores/app-store.ts` line 136-142 — Notes added without sanitization:
    ```typescript
    addNote: (note) =>
      set((state) => ({
        callNotes: [
          ...state.callNotes,
          { ...note, id: `note-${Date.now()}`, createdAt: new Date().toISOString() },
        ],
      })),
    ```
  - `src/lib/mock-service.ts` lines 159-170 — CSV export with basic escaping but no sanitization
- **Impact:**
  - Any user can impersonate any role; Slack webhook exposed in DevTools
  - Stored XSS possible if content rendered in unsafe context
  - CSV injection via malicious formulas (e.g., `=cmd|' /C calc'!A0`)
  - Backend injection when real API is added
  - Prompt injection when transcripts/notes are processed by AI
- **Likelihood:** High (immediate risk in any deployment beyond demo)
- **Severity:** Critical
- **Mitigations / Controls:**
  1. Implement server-side authentication with AWS Cognito (see TD-02)
  2. Add Zod validation schemas for all user inputs at store boundaries
  3. Sanitize content before storage using DOMPurify or similar library
  4. Prefix CSV cells with single quote (`'`) to prevent formula injection
  5. Validate webhook URLs against expected Slack format
  6. Implement Content Security Policy (CSP) headers
  7. For AI integration: sanitize transcripts, use prompt delimiters, validate AI outputs
- **Trust Boundary / Human-in-the-Loop:**
  - **Mandatory:** User provisioning and role assignment requires admin review
  - **Cannot Automate:** Role escalation (agent → supervisor) requires human approval
  - **Audit Required:** All access to call recordings and transcripts must be logged

---

### R-03: Vendor Lock-in and Platform Dependencies

- **Area:** Dependency Risk
- **Description:** The project creates multiple vendor dependencies that pose business continuity and maintenance risks. The codebase was generated by Lovable.dev (evidenced by `lovable-tagger` dependency), creating dependency on their patterns. The target architecture assumes AWS services (Connect, Bedrock, Comprehend, S3) with no abstraction layer. The UI depends on 40+ Radix UI components via shadcn/ui, and any major version changes require coordinated updates across the component library.
- **Evidence:**
  - `package.json` line 79: `"lovable-tagger": "^1.1.11"`
  - `vite.config.ts` lines 12-13 — Lovable dev tooling: `plugins: [react(), mode === "development" && componentTagger()].filter(Boolean)`
  - `package.json` lines 15-41 — 27 `@radix-ui/*` dependencies
  - `src/components/ui/` — 49 shadcn/ui component files
  - No abstraction layer for NLP services; direct AWS integration would be hard to replace
- **Impact:**
  - **Cost escalation:** AWS pricing changes cannot be mitigated without architectural changes
  - **Feature availability:** New features depend on vendor roadmaps (e.g., Bedrock model availability)
  - **Migration difficulty:** Switching NLP providers (Azure AI, Google Cloud) would require significant refactoring
  - **Maintenance burden:** Coordinating updates across 40+ Radix dependencies
  - **Knowledge gap:** Team may not understand Lovable-generated patterns
- **Likelihood:** Medium
- **Severity:** Medium
- **Mitigations / Controls:**
  1. Implement adapter pattern for external services:
     - `INlpService` with `BedrockNlpService`, `AzureNlpService` implementations
     - `IStorageService` abstracting S3 operations
  2. Audit all Lovable-generated components for alignment with team standards
  3. Remove `lovable-tagger` from production build if not actively using Lovable
  4. Document which components are generated vs. hand-written
  5. Conduct quarterly dependency audit using `npm audit` and Snyk
  6. Pin major versions of critical dependencies; test upgrades in isolation
  7. Maintain documented procedures for migrating off each critical vendor
- **Trust Boundary / Human-in-the-Loop:**
  - **Mandatory Review:** All Lovable-generated or AI-generated code must pass team code review
  - **Cannot Automate:** Architectural decisions (service providers, major upgrades) require human approval
  - **Documentation Required:** Any use of code generation tools documented in ADRs

---

## Priority Shortlist (Top 3 Debt Items)

| Rank | ID | Title | Severity | Effort | Rationale | Proposed Sprint |
|------|----|-------|----------|--------|-----------|-----------------|
| 1 | TD-03 | Zero Automated Test Coverage | Critical | M | Foundation for all safe changes; enables refactoring; required before any production deployment | Sprint 1 |
| 2 | TD-01 | Mock-Only Data Layer | Critical | L | Blocks AWS Connect integration; high effort but unlocks production capability; parallelize with TD-02 | Sprint 2-3 |
| 3 | TD-02 | Mock Authentication | Critical | M | Security prerequisite for any real data; can leverage existing Cognito/Auth0 libraries | Sprint 2 |

**Effort Key:** S = 1-2 days | M = 3-5 days | L = 1-2 weeks

**Rationale for Ranking:**
- TD-03 (Tests) ranked first because it enables safe execution of TD-01 and TD-02 refactoring
- TD-01 (Data Layer) ranked second due to critical path for AWS integration, though higher effort
- TD-02 (Auth) ranked third as security prerequisite; can proceed in parallel with TD-01

---

## Notes & Assumptions

### Verified Facts

- No test files exist in repository (confirmed via file search)
- TypeScript strict mode is disabled in both `tsconfig.json` and `tsconfig.app.json`
- No CI/CD configuration exists (no `.github/workflows/` directory)
- Mock users are hardcoded in `auth-store.ts` with credentials in source
- All state persists to localStorage via Zustand persist middleware
- Slack webhook is stored in client-side localStorage
- 49 shadcn/ui component files exist in `src/components/ui/`
- `lovable-tagger` is listed as a devDependency

### Assumptions (Needs Verification)

1. **Target deployment:** Assumed static SPA with separate backend service (not SSR)
2. **Authentication provider:** Assumed AWS Cognito given Amazon Connect context; not confirmed
3. **AI integration:** Assumed Amazon Bedrock for sentiment/summarization; no documentation confirms
4. **Compliance requirements:** HIPAA/SOC2/GDPR requirements unknown; assumed contact center data contains PII
5. **Team capacity:** Effort estimates assume 2-3 developers; actual velocity not provided

### Missing Information Requested

- [ ] Target AWS region and hosting service
- [ ] Expected concurrent user count for capacity planning
- [ ] Specific compliance requirements (HIPAA, SOC2, GDPR)
- [ ] AWS Connect instance details and available APIs
- [ ] Product roadmap for feature prioritization alignment
