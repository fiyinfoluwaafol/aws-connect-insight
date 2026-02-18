import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, MOCK_USERS, User } from "../auth-store";

describe("auth-store", () => {
  beforeEach(() => {
    useAuthStore.getState().signOut();
  });

  it("starts with null user", () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("signIn sets user", () => {
    const user = MOCK_USERS[0];
    useAuthStore.getState().signIn(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("signOut clears user", () => {
    useAuthStore.getState().signIn(MOCK_USERS[0]);
    useAuthStore.getState().signOut();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
