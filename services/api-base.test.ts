import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl } from "./api-base";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns the configured app base URL when present", () => {
    vi.stubEnv("APP_BASE_URL", "https://budio.nl");

    expect(getApiBaseUrl()).toBe("https://budio.nl");
  });

  it("normalizes Expo web dev server origins to the local API server", () => {
    vi.stubEnv("APP_BASE_URL", "http://localhost:8081");

    expect(getApiBaseUrl()).toBe("http://localhost:3001");
  });

  it("falls back to the current web origin when no env var is set", () => {
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubGlobal("window", {
      location: {
        hostname: "budio.nl",
        origin: "https://budio.nl",
      },
    });

    expect(getApiBaseUrl()).toBe("https://budio.nl");
  });

  it("prefers the browser origin over a configured production base url on web", () => {
    vi.stubEnv("APP_BASE_URL", "https://budio.nl");
    vi.stubGlobal("window", {
      location: {
        hostname: "www.budio.nl",
        origin: "https://www.budio.nl",
      },
    });

    expect(getApiBaseUrl()).toBe("https://www.budio.nl");
  });
});
