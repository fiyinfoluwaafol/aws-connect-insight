import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";
import { useAuthStore, User } from "@/stores/auth-store";

const mockSupervisor: User = {
  id: "sup-1",
  email: "supervisor@example.com",
  firstName: "Test",
  lastName: "Supervisor",
  role: "supervisor",
  teamId: "team-east",
};

const mockAgent: User = {
  id: "agent-1",
  email: "agent@example.com",
  firstName: "Test",
  lastName: "Agent",
  role: "agent",
};

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
    useAuthStore.setState({ user: null, isLoading: false, error: null });
  });

  it("redirects to signin when not authenticated", () => {
    render(<TestApp />);
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated with correct role", () => {
    useAuthStore.setState({ user: mockSupervisor, isLoading: false });
    render(<TestApp />);
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects agent to agent dashboard when accessing supervisor route", () => {
    useAuthStore.setState({ user: mockAgent, isLoading: false });
    render(<TestApp />);
    expect(screen.getByText("Agent Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("shows loading spinner while checking auth", () => {
    useAuthStore.setState({ user: null, isLoading: true });
    render(<TestApp />);
    expect(screen.queryByText("Sign In Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});
