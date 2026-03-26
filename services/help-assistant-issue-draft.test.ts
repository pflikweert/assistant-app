import { describe, expect, it } from "vitest";

import {
  buildIssueDraftPreview,
  resolveHelpAssistantIssueDraftAction,
} from "./help-assistant-issue-draft";
import { buildHelpAssistantContext } from "./help-assistant-context";
import type { HelpAssistantMessage } from "./help-assistant-chat";

function createUserMessage(text: string): HelpAssistantMessage {
  return {
    id: "msg-1",
    role: "user",
    status: "ready",
    text,
    createdAtIso: "2026-03-26T12:00:00.000Z",
    metadata: {
      source: "composer",
      intent: "general_help",
      target: "issue_draft",
      classification: {
        intent: "mogelijke_bug",
        confidence: "high",
        matchedSignals: ["keyword:fout"],
        classifierVersion: "v1_heuristic",
      },
      routeName: "/insights",
      screenId: "insights",
      screenTitle: "Inzichten",
      periodLabel: "maart 2026",
      platform: "web",
      issueDraftCandidate: true,
      spendingAdviceCandidate: false,
    },
  };
}

describe("help-assistant-issue-draft", () => {
  it("builds a preview for bug-like messages", () => {
    const context = buildHelpAssistantContext({
      screenId: "insights",
      routeName: "/insights",
      selectedPeriod: { label: "maart 2026" },
    });
    const message = createUserMessage("Ik zie een fout bij het importeren.");

    const preview = buildIssueDraftPreview({ message, context });

    expect(preview).not.toBeNull();
    expect(preview?.type).toBe("bug");
    expect(preview?.summary.toLowerCase()).not.toContain("bug:");
    expect(preview?.chatSummary).toContain("Klopt dat?");
    expect(preview?.confirmationPrompt).toContain("Budio");
    expect(preview?.labels).toContain("source:help-assistant");
    expect(preview?.labels).toContain("type:bug");
    expect(preview?.labels).toContain("screen:insights");
  });

  it("recognizes compact confirm and dismiss chat replies", () => {
    expect(resolveHelpAssistantIssueDraftAction("Ja, stuur maar door")).toBe(
      "confirm",
    );
    expect(
      resolveHelpAssistantIssueDraftAction("Ja, stuur maar naar Budio"),
    ).toBe("confirm");
    expect(resolveHelpAssistantIssueDraftAction("Nee, laat maar")).toBe(
      "dismiss",
    );
    expect(resolveHelpAssistantIssueDraftAction("Ik wil het nog aanpassen")).toBeNull();
  });
});
