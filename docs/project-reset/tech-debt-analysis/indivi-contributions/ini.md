# Technical Debt & Risk Analysis

This document summarizes individual contributions to the team's technical debt and risk analysis for the Amazon Connect Agent Supervisor Insights project.

### TD-02: Client-Side Mock Authentication with No Security Foundation

- **Category:** Architectural Debt
- **Summary:** Auth is fully client-side with hardcoded users and localStorage sessions, no token validation, and no server-side checks. Secrets like the Slack webhook are stored in the browser.
- **Evidence:**
- `src/stores/auth-store.ts` hardcoded mock users and persisted auth state
- `src/components/ProtectedRoute.tsx` only checks `user` presence
- `src/stores/app-store.ts` stores Slack webhook in localStorage
- **Impact:**
- Role impersonation is trivial via DevTools
- No protection against session hijacking or CSRF
- Compliance risk for PII/PHI handling
- **Severity:** Critical
- **Key actions:**
- Integrate Cognito/Auth0 with JWT access/refresh tokens
- Move tokens to httpOnly cookies and enforce session timeout
- Implement RBAC at the API layer
- Move webhooks/secrets server-side
- **Ticket:** "Replace mock auth with AWS Cognito and server-side session management"

---

### R-01: AI Hallucination in Call Summaries and Coaching Recommendations

- **Area:** Reliability/Hallucination
- **Summary:** Current “AI” features are rule-based, but real LLM integration will introduce hallucination and drift risks that can mislead supervisors and agents.
- **Evidence:**
- `src/lib/mock-service.ts` rule-based tip generation
- `src/lib/mock-data.ts` hardcoded sentiment thresholds and templated summaries
- No Bedrock/LLM SDKs in `package.json`
- **Impact:**
- Incorrect coaching or summaries can cause trust and HR issues
- Model updates can change output behavior unexpectedly
- Alert accuracy can degrade due to threshold drift
- **Likelihood:** High
- **Severity:** High
- **Key controls:**
- Ground summaries with RAG and validate output schema
- Show confidence scores and require human review for coaching tips
- Pin model versions and regression test with a golden dataset
- Log all AI outputs with model version and prompt metadata
- **Trust boundary:** AI outputs must be reviewed before actioning
