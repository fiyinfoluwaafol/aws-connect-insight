import { http, HttpResponse } from "msw";

/**
 * MSW request handlers - stub for future API endpoints.
 * Add handlers as real backend routes are built.
 */
export const handlers = [
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),
];
