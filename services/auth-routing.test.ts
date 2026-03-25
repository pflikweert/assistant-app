import { describe, expect, it } from "vitest";

import {
  getAuthRedirectPath,
  isAuthRoute,
  isRecoveryRoute,
} from "./auth-routing";

describe("isAuthRoute", () => {
  it("recognizes auth group routes", () => {
    expect(isAuthRoute(["auth", "login"])).toBe(true);
    expect(isAuthRoute(["auth", "register"])).toBe(true);
  });

  it("keeps the legacy login route recognized during migration", () => {
    expect(isAuthRoute(["login"])).toBe(true);
  });

  it("returns false for app routes", () => {
    expect(isAuthRoute(["(tabs)", "index"])).toBe(false);
    expect(isAuthRoute(["csv-import"])).toBe(false);
  });
});

describe("isRecoveryRoute", () => {
  it("recognizes the recovery reset screen", () => {
    expect(
      isRecoveryRoute({
        segments: ["auth", "reset-password"],
      }),
    ).toBe(true);
  });

  it("recognizes the recovery reset screen from pathname", () => {
    expect(
      isRecoveryRoute({
        segments: ["(tabs)", "index"],
        pathname: "/auth/reset-password",
      }),
    ).toBe(true);
  });

  it("returns false for the other auth routes", () => {
    expect(
      isRecoveryRoute({
        segments: ["auth", "login"],
      }),
    ).toBe(false);
    expect(
      isRecoveryRoute({
        segments: ["auth", "forgot-password"],
      }),
    ).toBe(false);
  });
});

describe("getAuthRedirectPath", () => {
  it("waits until auth bootstrap completes", () => {
    expect(
      getAuthRedirectPath({
        loading: true,
        isAuthenticated: false,
        segments: [],
      }),
    ).toBeNull();
  });

  it("redirects anonymous users to login when they hit app routes", () => {
    expect(
      getAuthRedirectPath({
        loading: false,
        isAuthenticated: false,
        segments: ["(tabs)", "index"],
      }),
    ).toBe("/auth/login");
  });

  it("keeps anonymous users on auth routes", () => {
    expect(
      getAuthRedirectPath({
        loading: false,
        isAuthenticated: false,
        segments: ["auth", "forgot-password"],
      }),
    ).toBeNull();
  });

  it("redirects authenticated users away from auth routes", () => {
    expect(
      getAuthRedirectPath({
        loading: false,
        isAuthenticated: true,
        segments: ["auth", "login"],
      }),
    ).toBe("/");
  });

  it("keeps authenticated users on app routes", () => {
    expect(
      getAuthRedirectPath({
        loading: false,
        isAuthenticated: true,
        segments: ["csv-import"],
      }),
    ).toBeNull();
  });

  it("keeps authenticated users on the recovery reset screen", () => {
    expect(
      getAuthRedirectPath({
        loading: false,
        isAuthenticated: true,
        segments: ["auth", "reset-password"],
      }),
    ).toBeNull();
  });

  it("keeps authenticated users on the recovery reset screen when pathname is available", () => {
    expect(
      getAuthRedirectPath({
        loading: false,
        isAuthenticated: true,
        segments: ["(tabs)", "index"],
        pathname: "/auth/reset-password",
      }),
    ).toBeNull();
  });
});
