import { http, HttpResponse } from "msw";

/**
 * MSW request handlers for API endpoints.
 */

const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  role: "supervisor" as const,
  team_id: "team-1",
};

export const handlers = [
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),

  http.post("http://localhost:8000/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email && body.password) {
      return HttpResponse.json({
        user: {
          id: mockUser.id,
          email: body.email,
          first_name: mockUser.first_name,
          last_name: mockUser.last_name,
          role: mockUser.role,
          team_id: mockUser.team_id,
        },
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
      });
    }
    return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
  }),

  http.post("http://localhost:8000/api/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:8000/api/auth/me", ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }
    return HttpResponse.json({
      id: mockUser.id,
      email: mockUser.email,
      first_name: mockUser.first_name,
      last_name: mockUser.last_name,
      role: mockUser.role,
      team_id: mockUser.team_id,
    });
  }),

  http.post("http://localhost:8000/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      role: string;
      team_id?: string;
    };
    return HttpResponse.json(
      {
        id: "new-user-id",
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        role: body.role,
        team_id: body.team_id,
      },
      { status: 201 }
    );
  }),

  http.post("http://localhost:8000/api/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refresh_token?: string };
    if (body.refresh_token) {
      return HttpResponse.json({
        access_token: "mock-access-token-refreshed",
        refresh_token: "mock-refresh-token-rotated",
      });
    }
    return HttpResponse.json({ detail: "No refresh token provided" }, { status: 401 });
  }),

  http.post("http://localhost:8000/api/auth/forgot-password", () => {
    return HttpResponse.json({ message: "If the email exists, a reset link has been sent" });
  }),

  http.post("http://localhost:8000/api/auth/reset-password", async ({ request }) => {
    const body = (await request.json()) as { token: string; new_password: string };
    if (body.token && body.new_password) {
      return HttpResponse.json({ message: "Password reset successfully" });
    }
    return HttpResponse.json({ detail: "Invalid or expired reset token" }, { status: 401 });
  }),

  http.patch("http://localhost:8000/api/auth/change-password", async ({ request }) => {
    const body = (await request.json()) as { current_password: string; new_password: string };
    if (body.current_password && body.new_password) {
      return HttpResponse.json({ message: "Password changed successfully" });
    }
    return HttpResponse.json({ detail: "Current password is incorrect" }, { status: 401 });
  }),
];
