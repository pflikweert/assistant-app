import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
  },
}));

import {
  getCurrentUser,
  requireCurrentUser,
  requireCurrentUserId,
} from "./current-user";

describe("current-user helpers", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("returns the active user when available", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toMatchObject({ id: "user-123" });
  });

  it("returns null when there is no active session", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("throws when auth.getUser returns an error", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("boom"),
    });

    await expect(getCurrentUser()).rejects.toThrow("boom");
  });

  it("requires an authenticated user for requireCurrentUser", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(requireCurrentUser()).rejects.toThrow("No active user session.");
  });

  it("returns the id for requireCurrentUserId", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-abc" } },
      error: null,
    });

    await expect(requireCurrentUserId()).resolves.toBe("user-abc");
  });
});
