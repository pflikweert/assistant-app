import { describe, expect, it } from "vitest";
import {
  designSystemHubChangelogEntries,
  designSystemHubComponentFamilies,
  designSystemHubMeta,
  designSystemHubPatternBlocks,
  designSystemHubSections,
  designSystemHubSources,
  designSystemHubSyncCommands,
  designSystemHubTokenGroups,
} from "./design-system-hub";

describe("designSystemHub", () => {
  it("legt de complete hub-structuur vast", () => {
    expect(designSystemHubSections.map((section) => section.id)).toEqual([
      "overview",
      "tokens",
      "components",
      "motion",
      "patterns",
      "sources",
      "changelog",
    ]);
    expect(designSystemHubTokenGroups.length).toBeGreaterThanOrEqual(5);
    expect(designSystemHubComponentFamilies.length).toBeGreaterThanOrEqual(5);
    expect(designSystemHubPatternBlocks.length).toBeGreaterThanOrEqual(4);
    expect(designSystemHubSources.some((item) => item.label === "Stitch project")).toBe(true);
    expect(designSystemHubSyncCommands.length).toBeGreaterThanOrEqual(3);
    expect(designSystemHubChangelogEntries.length).toBeGreaterThanOrEqual(3);
  });

  it("houdt de canonieke Stitch assets expliciet zichtbaar", () => {
    expect(designSystemHubMeta.stitchProjectId).toBe("projects/12076228720239525233");
    expect(designSystemHubMeta.canonicalAssetId).toBe("assets/ead01f9cb9454e8da9de7ec3d8ef18e6");
    expect(designSystemHubMeta.canonicalAssetDisplayName).toBe("Budio Core Fintech");
  });
});
