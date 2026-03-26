import { describe, expect, it } from "vitest";

import {
  createInitialHelpAssistantIssueFlowState,
  helpAssistantIssueFlowReducer,
  type HelpAssistantIssueFlowStructuredResponse,
} from "./help-assistant-issue-flow";
import { buildHelpAssistantContext } from "./help-assistant-context";
import { createInitialHelpAssistantThreadState } from "./help-assistant-chat";

function createUserMessage(text: string) {
  return {
    id: "msg-1",
    role: "user" as const,
    status: "ready" as const,
    text,
    createdAtIso: "2026-03-26T12:00:00.000Z",
    metadata: {
      source: "composer" as const,
      intent: "general_help" as const,
      target: "issue_draft" as const,
      classification: {
        intent: "feature_request" as const,
        confidence: "high" as const,
        matchedSignals: ["keyword:idee"],
        classifierVersion: "v1_heuristic" as const,
      },
      routeName: "/insights",
      screenId: "insights" as const,
      screenTitle: "Inzichten",
      periodLabel: "maart 2026",
      platform: "web",
      issueDraftCandidate: true,
      spendingAdviceCandidate: false,
    },
  };
}

describe("help-assistant-issue-flow", () => {
  it("uses structured OpenAI issue intake metadata to build a reviewable draft", () => {
    const context = buildHelpAssistantContext({
      screenId: "insights",
      routeName: "/insights",
      selectedPeriod: { label: "maart 2026" },
    });
    const thread = {
      ...createInitialHelpAssistantThreadState(),
      messages: [createUserMessage("Ik heb een idee voor Inzichten")],
      pendingIssueDraftIds: ["msg-1"],
    };

    const response: HelpAssistantIssueFlowStructuredResponse = {
      meta: {
        route: "issue_intake",
        type: "idea",
        subtype: "idea",
        confidence: "high",
        state: "ready_to_review",
        needsClarification: false,
        context: {
          screenId: "insights",
          screenTitle: "Inzichten",
          routeName: "/insights",
          platform: "web",
          periodLabel: "maart 2026",
        },
      },
      answerText: "Ik denk dat je een idee hebt voor Inzichten.",
      summary: "Grafiek voor forecast",
      featureArea: "Inzichten",
      userNeed: "Je wilt een grafiek zien voor forecast",
      proposedChange: "een grafiek laat de forecast zien",
      isReadyForSubmission: true,
    };

    const next = helpAssistantIssueFlowReducer(
      createInitialHelpAssistantIssueFlowState(),
      {
        type: "sync",
        thread,
        context,
        composerValue: "",
        structuredResponse: response,
        anchorMessageId: "msg-1",
      },
    );

    expect(next.status).toBe("ready_to_review");
    expect(next.activeDraft?.summary).toBe("Grafiek voor forecast");
    expect(next.activeDraft?.featureArea).toBe("Inzichten");
    expect(next.activeDraft?.signalType).toBe("idea");
  });

  it("blocks premature submit when the draft is not review-ready", () => {
    const collecting = helpAssistantIssueFlowReducer(
      createInitialHelpAssistantIssueFlowState(),
      {
        type: "request_submit",
      },
    );

    expect(collecting.status).toBe("idle");
    expect(collecting.activeDraft).toBeNull();
  });

  it("keeps the cancel state closed until a new issue signal arrives", () => {
    const initial = {
      ...createInitialHelpAssistantIssueFlowState(),
      status: "ready_to_review" as const,
      anchorMessageId: "msg-1",
      activeDraft: {
        activeDraftId: "idea-draft:msg-1",
        status: "ready_to_review" as const,
        signalType: "idea" as const,
        featureArea: "Dashboard",
        userNeed: "Je wilt grafieken zien op het dashboard",
        proposedChange: "een grafiek toont de maandbudgetruimte",
        summary: "Grafiek voor dashboard",
        isReadyForSubmission: true,
        sourceMessageIds: ["msg-1"],
        sourceMessageText: "ik zou mijn budget van de hele maand in een grafiek willen zien",
        type: "feature_request" as const,
        context: {
          screenTitle: "Dashboard",
          routeName: "/dashboard",
          periodLabel: "maart 2026",
          platform: "web",
        },
        labels: ["source:help-assistant", "type:feature", "screen:dashboard"],
        shortDescription: "Gebruikersmelding op Dashboard",
      },
      errorMessage: null,
    };

    const cancelled = helpAssistantIssueFlowReducer(initial, { type: "cancel" });

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.activeDraft).toBeNull();
    expect(cancelled.anchorMessageId).toBe("msg-1");
  });
});
