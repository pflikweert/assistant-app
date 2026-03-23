/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  getSession: getSessionMock,
}));

import {
  getCurrentUser,
  requireCurrentUser,
  requireCurrentUserId,
} from "./current-user";

describe("current-user helpers", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it("returns the active user when available", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    });

    await expect(getCurrentUser()).resolves.toMatchObject({ id: "user-123" });
  });

  it("returns null when there is no active session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("throws when auth.getUser returns an error", async () => {
    getSessionMock.mockRejectedValue(new Error("boom"));

    await expect(getCurrentUser()).rejects.toThrow("boom");
  });

  it("requires an authenticated user for requireCurrentUser", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireCurrentUser()).rejects.toThrow("No active user session.");
  });

  it("returns the id for requireCurrentUserId", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-abc" } });

    await expect(requireCurrentUserId()).resolves.toBe("user-abc");
  });
});
