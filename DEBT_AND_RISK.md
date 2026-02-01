# Technical Debt & Risk Assessment

> A high-level overview of known debt and risks in this project. Not meant to be exhaustive or nitpicky—just honest about where we are.

---

## Architectural Debt

**The app is entirely client-side with simulated data.**

- All data lives in localStorage. There's no backend, no database, no real API calls.
- Authentication is fake—users are hardcoded in `auth-store.ts`. Anyone can "log in" as any role.
- The mock service layer (`mock-service.ts`) simulates what would be real AWS Connect API calls. The interfaces may not match actual AWS Connect data shapes.
- State management is simple (Zustand + localStorage), which works for a demo but doesn't handle multi-user scenarios, real-time updates, or data sync.

**What this means:** The entire backend integration is ahead of us. The current architecture is a UI prototype, not a foundation for production.

---

## AI-Assisted Development Debt

**This codebase was largely generated with AI assistance. That comes with specific debt:**

- **Knowledge gaps** — Code exists that the team may not fully understand. Before modifying anything significant, take time to read and understand what's there.
- **Inconsistent patterns** — AI tools don't always remember decisions from earlier in the conversation. You may find slightly different approaches to the same problem in different files.
- **"Works but why?"** — Some code is functional but over-engineered or structured in ways that made sense to the AI but may not be intuitive. Don't be afraid to simplify.
- **Mock data assumptions** — The generated mock data (`mock-data.ts`) makes assumptions about what real contact center data looks like. These assumptions are guesses, not based on real AWS Connect schemas.
- **Missing edge cases** — AI tends to generate the happy path. Error states, empty states, and weird user behavior may not be handled well.
- **Copy-paste residue** — Look for duplicated logic that could be consolidated. AI often generates similar code in multiple places rather than abstracting.

**What this means:** Treat the codebase as a starting point, not gospel. Refactor freely. The AI doesn't have feelings about its code.

---

## Production Readiness Gaps

**Things that don't exist yet but would be needed for a real working demo:**

| Gap | Why it matters |
|-----|----------------|
| Real authentication | Currently anyone can access anything. Need actual auth (Cognito, Auth0, etc.) |
| Backend API | Need actual endpoints, not mock functions returning fake data |
| Real AWS Connect integration | The whole point—need to pull actual call data, transcripts, sentiment |
| Error handling | Almost no error boundaries or failure states. Things will break silently. |
| Loading states | Some exist, but API latency isn't really simulated. Real calls take time. |
| Input validation | Forms mostly trust user input. Need proper validation before hitting a real API. |
| Environment config | Hardcoded values scattered around. Need proper env vars for different environments. |

---

## Security Considerations

**Not currently addressed (fine for a demo, not fine for production):**

- No real authorization—role checks are client-side only
- Sensitive data (call transcripts, customer info) would need encryption
- No audit logging for compliance (who accessed what, when)
- No rate limiting or abuse prevention
- localStorage is not secure storage for anything sensitive

---

## Recommendations

When picking this back up, consider this order of priority:

1. **Understand before changing** — Read through the core files (`app-store.ts`, `mock-service.ts`, `mock-data.ts`) so the team has shared understanding.

2. **Define real data shapes** — Look at actual AWS Connect APIs and update TypeScript interfaces to match reality. This will reveal gaps in the mock data.

3. **Add a backend** — Even a simple one. This separates concerns and forces you to think about real data flow.

4. **Consolidate patterns** — Pick one way to do things (data fetching, error handling, form state) and apply it consistently.

5. **Add error states** — Before adding features, make sure existing features fail gracefully.

---

## What This Doc Is Not

- Not a bug tracker—specific issues should go in GitHub Issues
- Not a style guide—that's a separate concern
- Not permanent—update this as debt gets paid down or new risks emerge

---

*Last updated: January 2025*
