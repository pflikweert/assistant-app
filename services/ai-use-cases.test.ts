import { beforeEach, describe, expect, it } from "vitest";

import {
  buildDefaultAiRouteSettings,
  getDefaultAiModelForUseCase,
} from "./ai-use-cases.ts";

describe("ai-use-cases defaults", () => {
  const previousModel = process.env.OPENAI_MODEL;

  beforeEach(() => {
    if (previousModel) process.env.OPENAI_MODEL = previousModel;
    else delete process.env.OPENAI_MODEL;
  });

  it("assigns deliberate per-use-case defaults without an override", () => {
    delete process.env.OPENAI_MODEL;

    const defaults = buildDefaultAiRouteSettings();

    expect(defaults.find((row) => row.use_case === "help_general")?.model).toBe(
      "gpt-5.4-nano",
    );
    expect(
      defaults.find((row) => row.use_case === "help_spending_advice")?.model,
    ).toBe("gpt-5.4-mini");
    expect(defaults.find((row) => row.use_case === "budget_coach")?.model).toBe(
      "gpt-5.4-mini",
    );
    expect(
      defaults.find((row) => row.use_case === "transaction_categorization")?.model,
    ).toBe("gpt-5.4-nano");
    expect(getDefaultAiModelForUseCase("import_pdf_mapping")).toBe("gpt-5.4-mini");
  });

  it("lets an explicit OPENAI_MODEL override all route defaults", () => {
    process.env.OPENAI_MODEL = "gpt-5.4";

    const defaults = buildDefaultAiRouteSettings();

    expect(defaults.every((row) => row.model === "gpt-5.4")).toBe(true);
  });
});
