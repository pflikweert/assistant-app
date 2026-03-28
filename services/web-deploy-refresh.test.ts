import { describe, expect, it } from "vitest";
import {
  isReloadNeeded,
  parseBuildIdFromHtml,
} from "@/services/web-deploy-refresh";

describe("web-deploy-refresh", () => {
  it("parset build-id uit meta tag", () => {
    const html = `
      <html>
        <head>
          <meta name="budio-build-id" content="abc123" />
        </head>
      </html>
    `;
    expect(parseBuildIdFromHtml(html)).toBe("abc123");
  });

  it("parset build-id uit window fallback script", () => {
    const html = `
      <script>window.__BUDIO_BUILD_ID__ = "sha-999";</script>
    `;
    expect(parseBuildIdFromHtml(html)).toBe("sha-999");
  });

  it("geeft null terug bij ontbrekende html id", () => {
    expect(parseBuildIdFromHtml("<html><head></head><body/></html>")).toBeNull();
  });

  it("triggert reload alleen bij echte mismatch", () => {
    expect(
      isReloadNeeded({
        currentBuildId: "old",
        remoteBuildId: "new",
        alreadyReloadedBuildId: null,
      }),
    ).toBe(true);

    expect(
      isReloadNeeded({
        currentBuildId: "same",
        remoteBuildId: "same",
        alreadyReloadedBuildId: null,
      }),
    ).toBe(false);

    expect(
      isReloadNeeded({
        currentBuildId: "old",
        remoteBuildId: "new",
        alreadyReloadedBuildId: "new",
      }),
    ).toBe(false);
  });
});

