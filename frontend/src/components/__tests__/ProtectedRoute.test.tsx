import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";
import { useAuthStore, MOCK_USERS } from "@/stores/auth-store";

function TestApp({ initialRoute = "/protected" }: { initialRoute?: string }) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRole="supervisor">
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/supervisor" element={<div>Supervisor Dashboard</div>} />
        <Route path="/agent" element={<div>Agent Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthStore.getState().signOut();
  });

  it("redirects to signin when not authenticated", () => {
    render(<TestApp />);
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated with correct role", () => {
    useAuthStore.getState().signIn(MOCK_USERS[0]); // supervisor
    render(<TestApp />);
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects agent to agent dashboard when accessing supervisor route", () => {
    useAuthStore.getState().signIn(MOCK_USERS[2]); // agent
    render(<TestApp />);
    expect(screen.getByText("Agent Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});
