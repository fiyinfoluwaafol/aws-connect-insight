# Risk & Technical Debt Inventory

## Context

This document catalogs the technical debt and system risks identified in the AWS Connect Insights prototype as it transitions from a Lovable.dev-generated demo into a production-ready system. The application serves as a "system orchestrator" for contact center supervisors and agents, aggregating call data, sentiment analysis, and coaching recommendations. This audit follows the **VIBE** principles—**Verify** current state, **Improve** identified gaps, **Build** sustainable foundations, and **Execute** prioritized remediation—to create an actionable roadmap for the capstone team.

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

### High-Level Architecture (Inferred) test

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

**Main Data Flows:**
1. **Authentication**: User clicks mock account → Zustand stores user object → localStorage persists session
2. **Call Search**: UI filters → MockService.searchCalls() → filters in-memory array → returns paginated results
3. **Alert Management**: Alerts loaded from mock data → stored in Zustand → status updates persist to localStorage
4. **Coaching Tips**: "Simulate Call End" → MockService.generatePostCallTips() → rule-based tip generation → stored in app-store

### Environment/Config Overview

| Aspect | Current State | Red Flag |
|--------|---------------|----------|
| **Environment Variables** | None used in codebase | ⚠️ No `.env` files, no `import.meta.env` usage |
| **Secrets Handling** | Slack webhook stored in localStorage via Zustand | 🔴 Exposed in browser DevTools |
| **Build Modes** | `dev`, `build`, `build:dev` scripts exist | ✅ Standard Vite setup |
| **Feature Flags** | `lovable-tagger` conditionally loaded in dev mode | ⚠️ Vendor-specific dev tooling |

### Current Testing/CI Status

| Aspect | Status |
|--------|--------|
| **Unit Tests** | ❌ None found (no `*.test.*` or `*.spec.*` files) |
| **Integration Tests** | ❌ None |
| **E2E Tests** | ❌ None |
| **Test Framework** | ❌ Not configured (no Jest/Vitest config) |
| **CI/CD Pipeline** | ❌ No `.github/workflows` directory |
| **Linting** | ✅ ESLint configured but rules relaxed (`@typescript-eslint/no-unused-vars: "off"`) |

---

## Part 1 — Technical Debt Audit

### TD-01: Mock-Only Data Layer with No Backend Integration Path

- **Category:** Architectural Debt
- **Description:** The entire application operates on client-side mock data with no abstraction layer for future backend integration. The `MockService` class directly manipulates in-memory arrays and Zustand stores, with hardcoded delays (`delay(200 + Math.random() * 200)`) to simulate network latency. There is no API client, no service interface, and no clear separation between data access and business logic.
- **Evidence:**
  - `src/lib/mock-data.ts` — Generates 300 calls at module load time with `const mockCalls = generateCalls(300);`
  - `src/lib/mock-service.ts` — Directly imports and filters `mockData.calls` array
  - `src/lib/mock-service.ts` lines 30-66:
    ```typescript
    async searchCalls(params: SearchParams): Promise<SearchResult> {
      await delay(200 + Math.random() * 200);
      // ... filters mockData.calls directly
      let filtered = mockData.calls.filter((call) => {
    ```
  - No HTTP client (axios, fetch wrapper) or API configuration exists
- **Impact:** 
  - Cannot connect to real Amazon Connect APIs without rewriting the entire data layer
  - Business logic (filtering, pagination) duplicated in mock layer will need reimplementation
  - Team velocity blocked when backend integration begins
- **Severity:** Critical
- **Remediation Plan:**
  1. Define TypeScript interfaces for all API contracts (calls, alerts, briefs, agents)
  2. Create an abstract `DataService` interface with methods matching current MockService
  3. Implement `MockDataService` that wraps current logic
  4. Create `ApiDataService` stub for future AWS Connect integration
  5. Use dependency injection or React Context to swap implementations
  6. Target: All data access goes through interface, not concrete mock implementation
- **Suggested Backlog Ticket Title:** "Abstract data layer with service interface for backend integration"

---

### TD-02: Disabled TypeScript Strict Mode Undermines Type Safety

- **Category:** Architectural Debt
- **Description:** TypeScript's strict checking is comprehensively disabled across the project, allowing implicit `any` types, unchecked null access, and unused variables. This undermines the primary benefit of using TypeScript and will cause runtime errors in production.
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
  - Null pointer exceptions at runtime (e.g., `user?.agentId` without null checks)
  - Dead code accumulates undetected
  - Refactoring is dangerous without type safety net
  - New team members may introduce bugs due to lenient type checking
- **Severity:** High
- **Remediation Plan:**
  1. Enable `strictNullChecks` first (highest impact, catches null access)
  2. Fix resulting type errors across codebase (estimate: 50-100 fixes)
  3. Enable `noImplicitAny` and add explicit types where needed
  4. Enable `strict: true` to get full type safety
  5. Re-enable ESLint unused variable rules
  6. Add pre-commit hook to prevent regression
- **Suggested Backlog Ticket Title:** "Enable TypeScript strict mode and fix type errors"

---

### TD-03: Zero Test Coverage Across Entire Codebase

- **Category:** Test Debt
- **Description:** The repository contains no automated tests of any kind—no unit tests, no integration tests, no end-to-end tests. There is no test runner configured (Jest, Vitest, Playwright, Cypress). The only quality gate is ESLint, which has relaxed rules.
- **Evidence:**
  - `package.json` — No test-related dependencies or scripts (no `jest`, `vitest`, `@testing-library/*`, `cypress`, `playwright`)
  - No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files found
  - No `jest.config.*` or `vitest.config.*` files
  - No `__tests__` or `tests` directories
  - `package.json` scripts (lines 6-11):
    ```json
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "lint": "eslint .",
      "preview": "vite preview"
    }
    ```
- **Impact:**
  - Cannot verify correctness of business logic (sentiment classification, alert generation, coaching tip rules)
  - Refactoring is high-risk without regression safety net
  - No confidence in deployments
  - Manual QA required for every change
- **Severity:** Critical
- **Remediation Plan:**
  1. Install Vitest (Vite-native, faster than Jest): `npm i -D vitest @testing-library/react @testing-library/jest-dom`
  2. Create `vitest.config.ts` with React plugin
  3. Add `test` script to package.json
  4. Write initial tests for critical paths:
     - `mock-service.ts`: searchCalls, generatePostCallTips, generateDailyBrief
     - `auth-store.ts`: signIn, signOut
     - `ProtectedRoute.tsx`: role-based redirect logic
  5. Target: 70%+ coverage on `/lib` and `/stores` before production
- **Suggested Backlog Ticket Title:** "Set up Vitest and achieve 70% test coverage on core logic"

---

### TD-04: Missing CI/CD Pipeline for Quality Gates

- **Category:** Architectural Debt
- **Description:** No continuous integration or deployment configuration exists. There are no GitHub Actions, no Vercel/Netlify deployment configs, and no automated quality checks on pull requests. This means linting, building, and (future) testing must be run manually.
- **Evidence:**
  - No `.github/workflows` directory
  - No `vercel.json`, `netlify.toml`, or similar deployment configs
  - No `.gitlab-ci.yml` or `Jenkinsfile`
  - `.gitignore` does not reference any CI artifacts
- **Impact:**
  - Broken builds can be merged to main branch
  - No automated deployment process
  - Team relies on manual discipline for code quality
  - Cannot enforce branch protection rules effectively
- **Severity:** Medium
- **Remediation Plan:**
  1. Create `.github/workflows/ci.yml` with:
     - Lint job: `npm run lint`
     - Build job: `npm run build`
     - Test job: `npm test` (after TD-03)
  2. Configure branch protection on `main` requiring CI pass
  3. Add deployment workflow for staging (e.g., Vercel preview deployments)
  4. Add production deployment workflow with manual approval gate
- **Suggested Backlog Ticket Title:** "Implement GitHub Actions CI/CD pipeline with branch protection"

---

### TD-05: Inadequate Documentation for Production Deployment

- **Category:** Documentation Debt
- **Description:** While the README is comprehensive for demo purposes, it lacks critical documentation for production deployment, API contracts, and architecture decisions. There are no ADRs (Architecture Decision Records), no deployment runbooks, and no documentation of the intended AWS Connect integration points.
- **Evidence:**
  - `README.md` — Documents mock authentication flow but not real auth requirements
  - No `docs/` directory
  - No `ARCHITECTURE.md` or `CONTRIBUTING.md`
  - No API contract documentation (what AWS Connect endpoints will be used)
  - README line 74-76 describes mock auth:
    ```markdown
    ## Mock Authentication
    The app uses mock authentication with pre-defined demo users
    ```
  - No mention of environment variables needed for production
  - No deployment instructions beyond `npm run build`
- **Impact:**
  - New team members cannot understand production requirements
  - Operations team cannot deploy without developer assistance
  - AWS Connect integration requirements unclear
  - No record of why architectural decisions were made
- **Severity:** Medium
- **Remediation Plan:**
  1. Create `docs/ARCHITECTURE.md` documenting:
     - Component hierarchy and data flow
     - State management strategy
     - Planned AWS Connect integration points
  2. Create `docs/DEPLOYMENT.md` with:
     - Required environment variables
     - Build and deployment steps
     - Infrastructure requirements
  3. Create `docs/ADR/` directory with initial decisions:
     - ADR-001: Choice of Zustand over Redux
     - ADR-002: Mock-first development approach
  4. Add API contract documentation for AWS Connect integration
- **Suggested Backlog Ticket Title:** "Create production deployment and architecture documentation"

---

### TD-06: Monolithic State Store with Mixed Concerns

- **Category:** Architectural Debt
- **Description:** The `app-store.ts` file contains a single Zustand store managing 9+ distinct domains (alerts, exemplars, bookmarks, notes, briefs, emails, tips, settings, notifications). This violates single responsibility and makes the store difficult to maintain, test, and reason about.
- **Evidence:**
  - `src/stores/app-store.ts` — 220 lines, single `useAppStore` managing:
    - Alerts (lines 56-61)
    - Exemplars (lines 63-68)
    - Bookmarks (lines 70-75)
    - Call Notes (lines 77-84)
    - Daily Briefs (lines 86-93)
    - Sent Emails (lines 95-102)
    - Agent Tips (lines 104-118)
    - Settings (lines 120-123)
    - Notifications (lines 125-135)
    - Reset (lines 137-149)
  - Store interface `AppState` has 20+ methods
- **Impact:**
  - Any change to one domain risks breaking others
  - Testing requires mocking entire store
  - Large bundle size for components that only need one slice
  - Difficult to implement domain-specific persistence strategies
- **Severity:** Medium
- **Remediation Plan:**
  1. Split into domain-specific stores:
     - `alerts-store.ts` — Alert state and mutations
     - `briefs-store.ts` — Daily briefs
     - `agent-store.ts` — Tips, notifications, bookmarks
     - `settings-store.ts` — App configuration
  2. Use Zustand's slice pattern or separate stores
  3. Implement selective persistence per store
  4. Update components to import only needed stores
- **Suggested Backlog Ticket Title:** "Refactor monolithic app-store into domain-specific stores"

---

## Part 2 — AI & System Risk Assessment

### R-01: No Real AI Integration Despite AI-Labeled Features

- **Area:** Reliability/Hallucination
- **Description:** The application presents features as AI-powered (e.g., "AI Summary", "Coaching Tips") but implements them with hardcoded rules and templated responses. There is no actual LLM integration, no sentiment analysis API, and no machine learning components. When real AI is integrated, the deterministic behavior users expect from the current mock will differ from probabilistic AI outputs.
- **Evidence:**
  - `src/lib/mock-service.ts` lines 261-293 — `generatePostCallTips()` uses if/else logic:
    ```typescript
    if (call.sentimentScore < -0.3) {
      tips.push('Try acknowledging the customer\'s frustration earlier');
    }
    if (call.durationSec > 900) {
      tips.push('Consider summarizing the issue earlier');
    }
    ```
  - `src/lib/mock-data.ts` lines 123-159 — `generateSummary()` returns template strings:
    ```typescript
    const summaries = {
      negative: `Customer called regarding delayed refund...`,
      positive: `Customer contacted for ${call.topics[0]} assistance...`,
    };
    ```
  - `src/components/CallDetailDrawer.tsx` line 171 — UI labels output as "AI Summary" when it's templated
  - No OpenAI, Anthropic, AWS Comprehend, or other AI SDK in `package.json`
- **Impact:**
  - Users may expect consistent outputs when real AI produces variable results
  - No infrastructure for prompt management, rate limiting, or cost control
  - Hallucination risk when LLM integration occurs (summaries may be factually wrong)
  - No evaluation framework to measure AI output quality
- **Likelihood:** High (will occur when AI is integrated)
- **Severity:** High
- **Mitigations / Controls:**
  1. Label current features as "Mock" or "Demo" in UI until real AI integration
  2. Design prompt templates with guardrails before LLM integration
  3. Implement response validation layer (check for PII, verify sentiment matches)
  4. Create AI output evaluation dataset from current mock data
  5. Add confidence scores to AI outputs and display to users
  6. Implement human review queue for low-confidence AI outputs
- **Trust Boundary / Human-in-the-Loop:**
  - **Mandatory Review:** AI-generated coaching tips should be reviewed by supervisors before being shown to agents in production
  - **Cannot Automate:** Call summaries should not auto-populate customer records without human verification
  - **Audit Trail:** All AI outputs must be logged with version info for compliance review

---

### R-02: Insecure Mock Authentication with No Path to Real Auth

- **Area:** Security & Ethics
- **Description:** Authentication is implemented as a client-side mock with hardcoded user credentials visible in source code. Session persistence uses unencrypted localStorage, and there is no CSRF protection, no session expiry, and no role validation on the server side (because there is no server). The Slack webhook URL is also stored in localStorage, exposing integration credentials.
- **Evidence:**
  - `src/stores/auth-store.ts` lines 15-21 — Hardcoded users:
    ```typescript
    export const MOCK_USERS: User[] = [
      { id: 'sup-1', email: 'supervisor.ada@demo.com', name: 'Ada', role: 'supervisor' },
      { id: 'agent-1', email: 'agent.jordan@demo.com', name: 'Jordan', role: 'agent' },
    ];
    ```
  - `src/stores/auth-store.ts` line 37 — Session stored in localStorage: `name: 'auth-storage'`
  - `src/stores/app-store.ts` lines 100-105 — Slack webhook in Settings:
    ```typescript
    const defaultSettings: Settings = {
      slackWebhook: '',  // Stored in localStorage when configured
    };
    ```
  - `src/components/ProtectedRoute.tsx` — Client-side only role check, bypassable via DevTools
- **Impact:**
  - Any user can impersonate any role by modifying localStorage
  - Slack webhook exposed in browser DevTools enables abuse
  - No audit trail for authentication events
  - Cannot meet compliance requirements (SOC 2, HIPAA for healthcare contact centers)
- **Likelihood:** High (immediate risk in any deployment)
- **Severity:** Critical
- **Mitigations / Controls:**
  1. **Immediate:** Add disclaimer that app is demo-only, not for production data
  2. **Short-term:** Integrate AWS Cognito or Auth0 for real authentication
  3. Implement server-side session management with httpOnly cookies
  4. Add role claims to JWT tokens validated on each request
  5. Move Slack webhook to server-side environment variables
  6. Implement session timeout and re-authentication
  7. Add audit logging for all authentication events
- **Trust Boundary / Human-in-the-Loop:**
  - **Mandatory:** User provisioning and role assignment must go through admin review
  - **Cannot Automate:** Role escalation (agent → supervisor) requires human approval
  - **Audit Required:** All access to call recordings and transcripts must be logged for compliance

---

### R-03: Vendor Lock-in to Lovable.dev Generated Patterns

- **Area:** Dependency Risk
- **Description:** The codebase was generated using Lovable.dev, as evidenced by the `lovable-tagger` dev dependency and the generated component patterns. This creates dependency on vendor-specific tooling and patterns that may not align with team standards or may become unsupported.
- **Evidence:**
  - `package.json` line 79: `"lovable-tagger": "^1.1.11"`
  - `vite.config.ts` lines 12-13:
    ```typescript
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    ```
  - `src/components/ui/` — 50+ shadcn/ui component files (standard pattern, but generated in bulk)
  - `swark-output/` — Architecture diagram auto-generated, suggests tooling workflow
- **Impact:**
  - Generated code may not follow team coding standards
  - Updates to Lovable.dev may break compatibility
  - Team may not understand generated patterns (reduced maintainability)
  - Hidden technical debt from generated code not visible without audit
- **Likelihood:** Medium
- **Severity:** Medium
- **Mitigations / Controls:**
  1. Audit all generated components for alignment with team standards
  2. Remove `lovable-tagger` from production dependencies (keep only if actively using)
  3. Document which components are generated vs. hand-written
  4. Establish coding standards document that supersedes generated patterns
  5. Consider migrating shadcn/ui components to team-maintained versions
  6. Add code review checklist for generated code modifications
- **Trust Boundary / Human-in-the-Loop:**
  - **Mandatory Review:** All Lovable.dev generated code must pass team code review
  - **Cannot Automate:** Architectural decisions should not be delegated to code generators
  - **Documentation Required:** Any use of code generation tools must be documented in ADRs

---

### R-04: No Input Validation or Sanitization on User-Generated Content

- **Area:** Security & Ethics
- **Description:** User inputs (call notes, keywords, Slack webhooks) are stored and rendered without validation or sanitization. While React provides some XSS protection, the lack of validation creates risks for SQL injection (when backend added), localStorage poisoning, and potential for malicious content in exported PDFs/CSVs.
- **Evidence:**
  - `src/components/CallDetailDrawer.tsx` lines 80-92 — Note added directly to store:
    ```typescript
    const handleAddNote = () => {
      if (!newNote.trim() || !user) return;
      addNote({
        callId: call.id,
        text: newNote.trim(),  // No sanitization
      });
    };
    ```
  - `src/pages/supervisor/Settings.tsx` lines 38-55 — Keywords added without validation:
    ```typescript
    updateSettings({
      keywords: [...settings.keywords, newKeyword.trim().toLowerCase()],
    });
    ```
  - `src/lib/mock-service.ts` lines 155-179 — CSV export includes user content:
    ```typescript
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const val = row[h];
          // Basic escaping but no sanitization
        })
      ),
    ].join('\n');
    ```
- **Impact:**
  - Stored XSS if content rendered in unsafe context
  - CSV injection via malicious formulas (=cmd|' /C calc'!A0)
  - PDF export may render malicious content
  - Backend injection when real API added
- **Likelihood:** Medium
- **Severity:** High
- **Mitigations / Controls:**
  1. Implement Zod validation schemas for all user inputs
  2. Sanitize content before storage using DOMPurify or similar
  3. Prefix CSV cells with `'` to prevent formula injection
  4. Validate Slack webhook URLs against expected format
  5. Implement Content Security Policy headers
  6. Add input length limits to prevent DoS via large payloads
- **Trust Boundary / Human-in-the-Loop:**
  - **Automated:** Basic validation (length, format) can be automated
  - **Manual Review:** Exported reports containing user-generated content should be reviewed before external sharing
  - **Audit Trail:** All user-generated content modifications should be logged

---

## Priority Shortlist (Top 3 Debt Items)

| Rank | ID | Title | Severity | Effort | Rationale | Proposed Sprint Target |
|------|----|-------|----------|--------|-----------|------------------------|
| 1 | TD-03 | Set up Vitest and achieve 70% test coverage | Critical | M | Foundation for all other changes; enables safe refactoring; blocks production deployment without it | Sprint 1 |
| 2 | TD-01 | Abstract data layer with service interface | Critical | L | Required for AWS Connect integration; high effort but unlocks production capability | Sprint 2-3 |
| 3 | TD-02 | Enable TypeScript strict mode | High | M | Catches bugs before runtime; relatively mechanical fixes; improves developer experience | Sprint 1 |

**Effort Key:** S = 1-2 days, M = 3-5 days, L = 1-2 weeks

---

## Notes & Assumptions

### Items That Could Not Be Verified

1. **AWS Connect Integration Points:** No documentation or code references to specific AWS Connect APIs (Streams, CTR, Contact Lens). Unable to assess API compatibility or data mapping requirements.

2. **Production Infrastructure:** No infrastructure-as-code (Terraform, CDK) or deployment configuration. Cannot verify hosting strategy, scaling requirements, or network architecture.

3. **Data Compliance Requirements:** Unable to determine if call recordings or customer PII will flow through this system. HIPAA/SOC2 compliance requirements unknown.

4. **Team Size and Velocity:** Effort estimates assume 2-3 developers. Actual sprint capacity not provided.

### Assumptions Made

1. **Target Deployment:** Assumed this will deploy as a static SPA with separate backend service (not SSR).

2. **Authentication Provider:** Assumed AWS Cognito will be used given Amazon Connect context, but no confirmation.

3. **AI Integration:** Assumed Amazon Comprehend and/or Bedrock will provide sentiment analysis and summarization, replacing mock implementations.

4. **Data Retention:** Assumed 30-day retention default in settings reflects actual compliance requirement.

### Missing Information Requested

- [ ] Target deployment environment (AWS region, hosting service)
- [ ] Expected concurrent user count for capacity planning
- [ ] Compliance requirements (HIPAA, SOC2, GDPR)
- [ ] AWS Connect instance details and available APIs
- [ ] Team access to AWS account for integration testing
- [ ] Product roadmap for feature prioritization alignment
