import { describe, expect, it } from "vitest";

import {
  classifyHelpAssistantIntent,
  classifyIntentFromQuickAction,
} from "./help-assistant-intent";

describe("help-assistant-intent", () => {
  it("classifies explanation questions", () => {
    const result = classifyHelpAssistantIntent("Leg dit scherm uit");
    expect(result.intent).toBe("uitlegvraag");
    expect(result.confidence).toBe("high");
  });

  it("classifies possible bug reports", () => {
    const result = classifyHelpAssistantIntent("Ik zie een fout bij importeren");
    expect(result.intent).toBe("mogelijke_bug");
    expect(result.confidence).toBe("high");
  });

  it("classifies organic feature idea language", () => {
    const result = classifyHelpAssistantIntent(
      "Ik zou wel grafieken willen zien op dit scherm",
    );
    expect(result.intent).toBe("feature_request");
    expect(["medium", "high"]).toContain(result.confidence);
  });

  it("classifies spending advice questions", () => {
    const result = classifyHelpAssistantIntent(
      "Hoeveel ruimte heb ik nog in maart 2026?",
    );
    expect(result.intent).toBe("spending_advice");
    expect(["medium", "high"]).toContain(result.confidence);
  });

  it("maps quick actions to classification intents", () => {
    const result = classifyIntentFromQuickAction({
      quickActionIntent: "feature_idea",
      quickActionId: "share_idea",
    });
    expect(result.intent).toBe("feature_request");
    expect(result.confidence).toBe("high");
    expect(result.matchedSignals).toContain("quick_action:share_idea");
  });
});
