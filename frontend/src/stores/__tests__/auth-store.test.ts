import { describe, it, expect, beforeEach } from "vitest";
import { clearAuthTokens } from "@/lib/auth-tokens";
import { useAuthStore, User } from "../auth-store";

const mockUser: User = {
  id: "test-user-id",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  role: "supervisor",
  teamId: "team-1",
};

describe("auth-store", () => {
  beforeEach(async () => {
    clearAuthTokens();
    useAuthStore.setState({ user: null, isLoading: false, error: null });
  });

  it("starts with null user", () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("signIn sets user on success", async () => {
    await useAuthStore.getState().signIn("test@example.com", "password123");
    const state = useAuthStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user?.email).toBe("test@example.com");
    expect(state.user?.role).toBe("supervisor");
    expect(state.isLoading).toBe(false);
  });

  it("signOut clears user", async () => {
    useAuthStore.setState({ user: mockUser });
    expect(useAuthStore.getState().user).not.toBeNull();

    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("clearError clears error state", () => {
    useAuthStore.setState({ error: "Some error" });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
