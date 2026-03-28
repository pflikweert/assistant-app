import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthRedirectUrl } from "./auth-url";

const { createURLMock } = vi.hoisted(() => ({
  createURLMock: vi.fn(),
}));

vi.mock("expo-linking", () => ({
  default: {
    createURL: createURLMock,
  },
  createURL: createURLMock,
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

describe("getAuthRedirectUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    createURLMock.mockReset();
  });

  it("uses the current web origin when available", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://budio.nl",
      },
    });

    expect(getAuthRedirectUrl("/auth/reset-password")).toBe(
      "https://budio.nl/auth/reset-password",
    );
    expect(createURLMock).not.toHaveBeenCalled();
  });

  it("prefers the configured site url over the local web origin", () => {
    vi.stubEnv("SITE_URL", "https://budio.nl");
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:3000",
      },
    });

    expect(getAuthRedirectUrl("/auth/reset-password")).toBe(
      "https://budio.nl/auth/reset-password",
    );
  });

  it("falls back to Expo linking on native runtimes", () => {
    vi.stubGlobal("window", undefined);
    createURLMock.mockReturnValue("budio://auth/login");

    expect(getAuthRedirectUrl("/auth/login")).toBe("budio://auth/login");
    expect(createURLMock).toHaveBeenCalledWith("/auth/login");
  });
});
