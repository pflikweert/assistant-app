import { describe, expect, it } from "vitest";

import {
  isRefreshTokenAuthError,
  isSessionIdleExpired,
  STALE_SESSION_TIMEOUT_MS,
} from "./auth-session";

describe("auth-session helpers", () => {
  it("detects refresh token errors from Supabase-style messages", () => {
    expect(
      isRefreshTokenAuthError(
        new Error("AuthApiError: Invalid Refresh Token: Refresh Token Not Found"),
      ),
    ).toBe(true);
    expect(
      isRefreshTokenAuthError({
        message: "refresh token not found",
      }),
    ).toBe(true);
  });

  it("ignores unrelated auth errors", () => {
    expect(isRefreshTokenAuthError(new Error("network timeout"))).toBe(false);
  });

  it("treats the session as stale once the timeout has elapsed", () => {
    const now = Date.UTC(2026, 2, 24, 12, 0, 0);
    expect(
      isSessionIdleExpired(now - STALE_SESSION_TIMEOUT_MS + 1, now),
    ).toBe(false);
    expect(isSessionIdleExpired(now - STALE_SESSION_TIMEOUT_MS, now)).toBe(
      true,
    );
  });
});

