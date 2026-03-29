import { describe, expect, it, vi } from "vitest";

describe("ai-model-catalog", () => {
  it("defaults to gpt-5.4-nano when no override is configured", async () => {
    vi.resetModules();
    const previousModel = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL;

    const { getDefaultAiModel, DEFAULT_AI_MODEL_ID, listAiModelOptions } =
      await import("./ai-model-catalog.ts");

    expect(DEFAULT_AI_MODEL_ID).toBe("gpt-5.4-nano");
    expect(getDefaultAiModel()).toBe("gpt-5.4-nano");
    expect(listAiModelOptions().map((option) => option.id)).toEqual([
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
    ]);

    if (previousModel) process.env.OPENAI_MODEL = previousModel;
  });

  it("prefers an explicit OPENAI_MODEL override", async () => {
    vi.resetModules();
    const previousModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_MODEL = "gpt-5.4-mini";

    const { getDefaultAiModel } = await import("./ai-model-catalog.ts");

    expect(getDefaultAiModel()).toBe("gpt-5.4-mini");

    if (previousModel) process.env.OPENAI_MODEL = previousModel;
    else delete process.env.OPENAI_MODEL;
  });
});
