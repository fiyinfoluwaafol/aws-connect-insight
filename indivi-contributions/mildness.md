# Individual Contribution — Mildness

**Source:** `DEBT_AND_RISK.md`
**Scope:** Assigned risk and technical debt items

### TD-04: TypeScript Strict Mode Disabled

- **Category:** Architectural Debt
- **Summary:** Strict TypeScript checks are off, allowing implicit `any`, unsafe null access, and unused code.
- **Evidence:**
- `tsconfig.json` disables `strictNullChecks`, `noImplicitAny`, `noUnusedLocals`
- `tsconfig.app.json` sets `strict: false`
- `eslint.config.js` turns off `@typescript-eslint/no-unused-vars`
- **Impact:**
- Runtime null errors and silent bugs
- Refactors are riskier and slower
- Dead code accumulates
- **Severity:** High
- **Key actions:**
- Enable `strictNullChecks` first and fix errors
- Turn on `noImplicitAny` and `strict: true`
- Re-enable unused-vars linting
- Add a pre-commit/typecheck gate
- **Ticket:** "Enable TypeScript strict mode and fix type errors"

---

### R-02: Security, Ethics, and Data Privacy Risks

- **Area:** Security & Ethics
- **Summary:** Client-only auth plus unsanitized user inputs and exports create XSS/CSV injection risks and privacy exposure; AI integration adds prompt-injection and bias risks.
- **Evidence:**
- `src/stores/auth-store.ts` hardcoded users
- `src/stores/app-store.ts` stores notes without sanitization
- `src/lib/mock-service.ts` CSV export without formula protection
- **Impact:**
- Role impersonation and data leakage
- Injection vulnerabilities in exports and future APIs
- Bias and unfair assessments in performance tooling
- **Likelihood:** High
- **Severity:** Critical
- **Key controls:**
- Server-side auth + RBAC and CSP headers
- Validate and sanitize all user inputs
- Prefix CSV cells to prevent formula injection
- Redact/anonymize PII before external AI calls
- **Trust boundary:** Human review required for role changes and performance decisions
