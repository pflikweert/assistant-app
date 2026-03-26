import { getApiBaseUrl } from "@/services/api-base";
import type { HelpAssistantIssueFlowDraft } from "@/services/help-assistant-issue-flow";
import { getSession } from "@/services/supabase";

const HELP_ASSISTANT_ISSUE_API_PATH = "/api/github/issues";

export type HelpAssistantIssueCreateResult = {
  issueNumber: number | null;
  issueUrl: string | null;
  issueNodeId: string | null;
  labels: string[];
  projectPreparation: {
    ready: boolean;
    issueNodeId: string | null;
  };
};

type HelpAssistantIssueApiResponse =
  | ({ message?: string; hint?: string } & Partial<HelpAssistantIssueCreateResult>)
  | null;

export async function createHelpAssistantIssueFromDraft(
  draft: HelpAssistantIssueFlowDraft,
): Promise<HelpAssistantIssueCreateResult> {
  const session = await getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Je sessie is verlopen. Log opnieuw in om een issue te maken.");
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Kan de API-locatie niet bepalen voor issue creatie.");
  }

  const response = await fetch(
    new URL(HELP_ASSISTANT_ISSUE_API_PATH, baseUrl).toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        draft: {
          sourceMessageId: draft.sourceMessageIds[0] || draft.activeDraftId,
          summary: draft.summary,
          featureArea: draft.featureArea,
          userNeed: draft.userNeed,
          proposedChange: draft.proposedChange,
          type: draft.type,
          context: draft.context,
          labels: draft.labels,
          shortDescription: draft.shortDescription,
          sourceMessageText: draft.sourceMessageText,
          sourceMessageIds: draft.sourceMessageIds,
        },
      }),
    },
  );

  const payload = (await response
    .json()
    .catch(() => null)) as HelpAssistantIssueApiResponse;

  if (!response.ok) {
    const message =
      (payload && typeof payload.message === "string" && payload.message.trim()) ||
      "Issue aanmaken mislukt.";
    const hint =
      payload && typeof payload.hint === "string" && payload.hint.trim()
        ? payload.hint.trim()
        : "";
    throw new Error(hint ? `${message} ${hint}` : message);
  }

  return {
    issueNumber:
      typeof payload?.issueNumber === "number" ? payload.issueNumber : null,
    issueUrl:
      typeof payload?.issueUrl === "string" && payload.issueUrl.trim()
        ? payload.issueUrl.trim()
        : null,
    issueNodeId:
      typeof payload?.issueNodeId === "string" && payload.issueNodeId.trim()
        ? payload.issueNodeId.trim()
        : null,
    labels: Array.isArray(payload?.labels)
      ? payload!.labels
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [],
    projectPreparation: {
      ready: Boolean(payload?.projectPreparation?.ready),
      issueNodeId:
        typeof payload?.projectPreparation?.issueNodeId === "string" &&
        payload.projectPreparation.issueNodeId.trim()
          ? payload.projectPreparation.issueNodeId.trim()
          : null,
    },
  };
}
