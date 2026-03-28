import { describe, expect, it } from "vitest";

import {
  formatCategorizationStatus,
  getCategorizationStatusSnapshot,
  resetCategorizationStatus,
  updateCategorizationStatus,
} from "./categorization-status";

describe("categorization-status", () => {
  it("initializes with phase label and deferred OpenAI counter", () => {
    resetCategorizationStatus();
    const snapshot = getCategorizationStatusSnapshot();

    expect(snapshot.phaseLabel).toBeNull();
    expect(snapshot.deferredOpenAiCount).toBe(0);
  });

  it("includes the active phase label in running status text", () => {
    resetCategorizationStatus();
    updateCategorizationStatus({
      phase: "running",
      phaseLabel: "openai",
      processedCount: 20,
      totalCount: 100,
      queuedCount: 80,
      message: "OpenAI verwerkt resterende transacties (40).",
    });

    const text = formatCategorizationStatus(getCategorizationStatusSnapshot());
    expect(text).toContain("fase: openai");
    expect(text).toContain("OpenAI verwerkt resterende transacties");
  });
});
