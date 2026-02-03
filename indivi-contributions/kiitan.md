# Individual Contribution — Kiitan

**Source:** `DEBT_AND_RISK.md`
**Scope:** Assigned risk and technical debt items

### TD-05: Missing Pre-Merge Quality Gates

- **Category:** Architectural Debt
- **Summary:** No CI checks run before merge, so lint/build/test failures can land on `main`.
- **Evidence:**
- No `.github/workflows/` directory
- No required lint/build/test checks in branch protection
- **Impact:**
- Broken builds merge before detection
- Linting errors and regressions slip through
- Manual quality enforcement becomes the default
- **Severity:** Medium
- **Key actions:**
- Add GitHub Actions workflow for lint, build, and test
- Require CI checks in branch protection
- Keep Vercel deploys after merge as-is
- **Ticket:** "Add GitHub Actions CI for pre-merge quality gates"

---

### TD-08: AI-Assisted Development Code Quality Debt

- **Category:** Architectural Debt
- **Summary:** AI-generated code introduces inconsistent patterns, duplicated logic, and missing edge-case handling that the team may not fully understand.
- **Evidence:**
- `package.json` includes `lovable-tagger`
- Many generated UI components in `src/components/ui/`
- Similar logic appears in multiple places (e.g., `mock-service.ts`)
- **Impact:**
- Maintenance burden and inconsistent patterns
- Higher risk of subtle bugs and missed edge cases
- Refactors are harder without shared understanding
- **Severity:** Medium
- **Key actions:**
- Audit core files for consistency and duplication
- Standardize patterns for data access and state updates
- Add explicit empty/error state handling
- Document AI-generated sections for future maintainers
- **Ticket:** "Audit and refactor AI-generated code for consistency and completeness"
