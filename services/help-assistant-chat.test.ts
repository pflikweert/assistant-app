import { describe, expect, it } from "vitest";

import {
  createInitialHelpAssistantThreadState,
  submitComposerMessageLocally,
} from "./help-assistant-chat";
import { buildHelpAssistantContext } from "./help-assistant-context";

describe("help-assistant-chat issue draft targeting", () => {
  it("marks bug-like composer messages as issue draft candidates", () => {
    const context = buildHelpAssistantContext({
      screenId: "import",
      routeName: "/import-control",
    });
    const thread = createInitialHelpAssistantThreadState();

    const result = submitComposerMessageLocally(
      thread,
      context,
      "Ik zie een fout bij importeren",
    );

    const userMessage = result.thread.messages.find((message) => message.role === "user");
    expect(userMessage?.metadata.target).toBe("issue_draft");
    expect(userMessage?.metadata.issueDraftCandidate).toBe(true);
    expect(result.thread.pendingIssueDraftIds).toHaveLength(1);
  });
});
