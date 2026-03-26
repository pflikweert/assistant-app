import type { HelpAssistantClassifiedIntent } from "@/services/help-assistant-intent";
import type { HelpAssistantContext } from "@/services/help-assistant-context";
import type {
  HelpAssistantMessage,
  HelpAssistantThreadState,
} from "@/services/help-assistant-chat";

export type HelpAssistantIssueFlowStatus =
  | "idle"
  | "collecting"
  | "ready_to_review"
  | "submitting"
  | "submitted"
  | "cancelled";

export type HelpAssistantIssueFlowType = "bug" | "feedback" | "feature_request";

export type HelpAssistantIssueFlowSignalType =
  | "general"
  | "idea"
  | "issue"
  | "feedback"
  | "bug";

export type HelpAssistantIssueFlowStructuredResponse = {
  meta: {
    route: "issue_intake";
    type: HelpAssistantIssueFlowSignalType;
    subtype: "general" | "idea" | "issue" | "feedback" | "bug";
    confidence: "low" | "medium" | "high";
    state: "collecting" | "ready_to_review";
    needsClarification: boolean;
    context: {
      screenId: string;
      screenTitle: string;
      routeName: string;
      platform: string;
      periodLabel: string | null;
    };
  };
  answerText: string;
  summary: string;
  featureArea: string;
  userNeed: string;
  proposedChange: string;
  isReadyForSubmission: boolean;
  followUpQuestion?: string;
};

export type HelpAssistantIssueFlowDraft = {
  activeDraftId: string;
  status: HelpAssistantIssueFlowStatus;
  signalType: HelpAssistantIssueFlowSignalType;
  featureArea: string;
  userNeed: string;
  proposedChange: string;
  summary: string;
  isReadyForSubmission: boolean;
  sourceMessageIds: string[];
  sourceMessageText: string;
  type: HelpAssistantIssueFlowType;
  context: {
    screenTitle: string;
    routeName: string;
    periodLabel: string | null;
    platform: string;
  };
  labels: string[];
  shortDescription: string;
};

export type HelpAssistantIssueFlowState = {
  status: HelpAssistantIssueFlowStatus;
  activeDraft: HelpAssistantIssueFlowDraft | null;
  anchorMessageId: string | null;
  errorMessage: string | null;
};

export type HelpAssistantIssueFlowAction =
  | {
      type: "sync";
      thread: HelpAssistantThreadState;
      context: HelpAssistantContext;
      composerValue?: string;
      structuredResponse?: HelpAssistantIssueFlowStructuredResponse | null;
      anchorMessageId?: string | null;
    }
  | { type: "request_submit" }
  | { type: "mark_submitted" }
  | { type: "mark_submit_failed"; errorMessage: string }
  | { type: "cancel" }
  | { type: "reset" };

const FEATURE_AREA_PATTERNS: { pattern: RegExp; area: string }[] = [
  { pattern: /\bforecast\b/i, area: "Forecast" },
  { pattern: /\bbudget\b/i, area: "Budget" },
  { pattern: /\btransactie(?:s)?\b/i, area: "Transacties" },
  { pattern: /\bimport\b/i, area: "Import" },
  { pattern: /\binzicht(?:en)?\b/i, area: "Inzichten" },
  { pattern: /\babonnement(?:en)?\b/i, area: "Abonnementen" },
  { pattern: /\brekening\b/i, area: "Rekeningen" },
];

const ISSUE_TRIGGER_PATTERNS: {
  pattern: RegExp;
  type: HelpAssistantIssueFlowType;
}[] = [
  { pattern: /\b(ik zie een fout|dit werkt niet|het werkt niet|klopt niet)\b/i, type: "bug" },
  { pattern: /\b(error|crash|vastgelopen|fout)\b/i, type: "bug" },
  { pattern: /\b(ik heb een idee|ik heb een suggestie|mijn suggestie is)\b/i, type: "feature_request" },
  { pattern: /\b(ik zou graag|ik wil graag|zou het kunnen|kunnen jullie)\b/i, type: "feature_request" },
  { pattern: /\b(het zou fijn zijn|het zou handig zijn|ik mis|ik wil dat)\b/i, type: "feature_request" },
  { pattern: /\b(grafiek|overzicht|filter|knop|weergave|visualisatie)\b/i, type: "feature_request" },
];

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function lowerFirst(value: string) {
  if (!value) return value;
  return `${value[0]?.toLowerCase() || ""}${value.slice(1)}`;
}

function truncateText(value: string, maxLength: number) {
  const trimmed = cleanText(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function stripLeadingIdeaPhrases(value: string) {
  let result = cleanText(value).replace(/[.!?]+$/g, "");
  const patterns = [
    /^ik heb een idee voor\s+/i,
    /^ik heb een idee over\s+/i,
    /^ik heb een idee\s+/i,
    /^ik heb een suggestie voor\s+/i,
    /^ik heb feedback over\s+/i,
    /^ik wil graag dat\s+/i,
    /^ik wil graag\s+/i,
    /^ik wil\s+/i,
    /^ik zou graag dat\s+/i,
    /^ik zou graag\s+/i,
    /^het zou fijn zijn als\s+/i,
    /^het zou handig zijn als\s+/i,
    /^ik zie een fout(?: bij| in| op)?\s+/i,
    /^ik zie\s+/i,
    /^er is iets mis met\s+/i,
    /^het werkt niet bij\s+/i,
    /^het werkt niet\s+/i,
    /^dit werkt niet\s+/i,
    /^mijn suggestie is\s+/i,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }

  return cleanText(result);
}

function getMessageIntent(
  message: HelpAssistantMessage,
): HelpAssistantClassifiedIntent | undefined {
  return message.metadata.classification?.intent;
}

function getIssueTypeFromIntent(
  intent: HelpAssistantClassifiedIntent | undefined,
): HelpAssistantIssueFlowType | null {
  if (intent === "mogelijke_bug") return "bug";
  if (intent === "feedback") return "feedback";
  if (intent === "feature_request") return "feature_request";
  return null;
}

function getIssueTypeFromText(text: string): HelpAssistantIssueFlowType | null {
  const normalized = cleanText(text);
  if (!normalized) return null;

  for (const candidate of ISSUE_TRIGGER_PATTERNS) {
    if (candidate.pattern.test(normalized)) return candidate.type;
  }

  return null;
}

function getSignalTypeFromIssueType(
  type: HelpAssistantIssueFlowType,
): HelpAssistantIssueFlowSignalType {
  if (type === "bug") return "bug";
  if (type === "feedback") return "feedback";
  return "idea";
}

function toIssueTypeFromSignalType(
  type: HelpAssistantIssueFlowSignalType,
): HelpAssistantIssueFlowType {
  if (type === "bug" || type === "issue") return "bug";
  if (type === "feedback") return "feedback";
  return "feature_request";
}

function buildStableDraftId(anchorMessageId: string) {
  return `idea-draft:${anchorMessageId}`;
}

function getFeatureArea(text: string, context: HelpAssistantContext) {
  const normalized = cleanText(text);
  for (const candidate of FEATURE_AREA_PATTERNS) {
    if (candidate.pattern.test(normalized)) return candidate.area;
  }
  return context.screenTitle;
}

function getUserNeed(texts: string[]) {
  const combined = cleanText(texts.map(stripLeadingIdeaPhrases).join(" "));
  if (!combined) return "";
  const clipped = truncateText(combined, 112);
  return clipped;
}

function getProposedChange(texts: string[], featureArea: string) {
  const combined = cleanText(texts.join(" "));

  if (/\bgrafiek\b/i.test(combined)) {
    return `een grafiek toont voor ${lowerFirst(featureArea.toLowerCase())}`;
  }
  if (/\boverzicht\b/i.test(combined)) {
    return `een duidelijk overzicht geeft in ${lowerFirst(featureArea.toLowerCase())}`;
  }
  if (/\bfilter\b/i.test(combined)) {
    return `een bruikbare filter toevoegt in ${lowerFirst(featureArea.toLowerCase())}`;
  }
  if (/\bduidelijker\b/i.test(combined)) {
    return `het duidelijker maakt in ${lowerFirst(featureArea.toLowerCase())}`;
  }
  if (/\bmeer\b.*\binfo\b/i.test(combined)) {
    return `meer relevante informatie laat zien in ${lowerFirst(featureArea.toLowerCase())}`;
  }
  if (/\btoont\b|\blaat zien\b|\bweergave\b/i.test(combined)) {
    return truncateText(stripLeadingIdeaPhrases(combined), 84);
  }

  const cleaned = stripLeadingIdeaPhrases(combined);
  if (!cleaned) {
    return `het slimmer maakt in ${lowerFirst(featureArea.toLowerCase())}`;
  }

  if (cleaned.length <= 36) {
    return `het beter laat werken in ${lowerFirst(featureArea.toLowerCase())}`;
  }

  return truncateText(cleaned, 92);
}

function getIssueSummary(
  type: HelpAssistantIssueFlowType,
  featureArea: string,
  userNeed: string,
  proposedChange: string,
) {
  const area = featureArea || "deze plek";
  if (type === "bug") {
    return truncateText(
      `Er lijkt iets mis te gaan in ${area}: ${userNeed || proposedChange}.`,
      170,
    );
  }

  if (type === "feedback") {
    return truncateText(
      `Je hebt feedback over ${area}: ${userNeed || proposedChange}.`,
      170,
    );
  }

  return truncateText(
    `Je wilt dat ${area.toLowerCase()} ${proposedChange}. ${userNeed && userNeed !== proposedChange ? `Daarmee los je op: ${userNeed}.` : ""}`.trim(),
    190,
  );
}

function getIssueLabels(
  type: HelpAssistantIssueFlowType,
  context: HelpAssistantContext,
) {
  return [
    "source:help-assistant",
    `type:${type === "feature_request" ? "feature" : type}`,
    `screen:${context.screenId}`,
  ];
}

function getShortDescription(
  sourceTexts: string[],
  context: HelpAssistantContext,
  featureArea: string,
) {
  const periodLabel = context.selectedPeriod?.label || "niet geselecteerd";
  return [
    `Gebruikersmelding op ${context.screenTitle}:`,
    ...sourceTexts.map((text) => cleanText(text)),
    "",
    `Context: scherm ${context.screenTitle}, route ${context.routeName}, periode ${periodLabel}, platform ${context.platform}.`,
    featureArea ? `Feature area: ${featureArea}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isConcreteEnough(input: {
  type: HelpAssistantIssueFlowType;
  sourceTexts: string[];
  featureArea: string;
  userNeed: string;
  proposedChange: string;
}) {
  const combinedLength = cleanText(input.sourceTexts.join(" ")).length;
  const hasMultipleMessages = input.sourceTexts.length >= 2;
  const hasSomeDetail = input.userNeed.length >= 18 || input.proposedChange.length >= 18;
  const hasStrongShape =
    input.featureArea.length > 0 &&
    input.userNeed.length > 10 &&
    input.proposedChange.length > 10;

  if (input.type === "bug") {
    return (
      hasStrongShape ||
      (combinedLength >= 30 && (hasSomeDetail || hasMultipleMessages))
    );
  }

  if (input.type === "feedback") {
    return hasStrongShape || (combinedLength >= 45 && (hasSomeDetail || hasMultipleMessages));
  }

  return (
    hasStrongShape ||
    hasMultipleMessages ||
    combinedLength >= 55
  );
}

function buildDraftFromMessages(input: {
  thread: HelpAssistantThreadState;
  context: HelpAssistantContext;
  anchorMessageId: string;
  composerValue?: string;
  structuredResponse?: HelpAssistantIssueFlowStructuredResponse | null;
}) {
  const anchorIndex = input.thread.messages.findIndex(
    (message) => message.id === input.anchorMessageId,
  );
  if (anchorIndex < 0) return null;

  const draftMessages = input.thread.messages.slice(anchorIndex);
  const userMessages = draftMessages.filter((message) => message.role === "user");
  if (!userMessages.length) return null;

  const sourceTexts = userMessages.map((message) => message.text);
  const composerText = cleanText(input.composerValue || "");
  if (composerText) {
    sourceTexts.push(composerText);
  }
  const combinedText = sourceTexts.join(" ");
  const structured = input.structuredResponse || null;
  const draftType =
    structured?.meta.type && structured.meta.type !== "general"
      ? toIssueTypeFromSignalType(structured.meta.type)
      : getIssueTypeFromIntent(
            [...userMessages]
              .reverse()
              .find((message) => isIssueTriggerMessage(message, input.context))
              ?.metadata.classification?.intent,
          ) ||
        getIssueTypeFromText(userMessages.map((message) => message.text).join(" ")) ||
        "feature_request";

  const featureArea = structured?.featureArea || getFeatureArea(combinedText, input.context);
  const userNeed = structured?.userNeed || getUserNeed(sourceTexts);
  const proposedChange =
    structured?.proposedChange || getProposedChange(sourceTexts, featureArea);
  const summary =
    structured?.summary ||
    getIssueSummary(draftType, featureArea, userNeed, proposedChange);
  const candidateReady =
    structured?.meta.state === "ready_to_review" ||
    isConcreteEnough({
      type: draftType,
      sourceTexts,
      featureArea,
      userNeed,
      proposedChange,
    });
  const isReadyForSubmission =
    structured?.meta.state === "ready_to_review"
      ? true
      : Boolean(structured?.isReadyForSubmission ?? candidateReady);
  const activeDraftId = buildStableDraftId(input.anchorMessageId);
  const status: HelpAssistantIssueFlowStatus = isReadyForSubmission
    ? "ready_to_review"
    : "collecting";

  return {
    activeDraftId,
    status,
    signalType: structured?.meta.type || getSignalTypeFromIssueType(draftType),
    featureArea,
    userNeed,
    proposedChange,
    summary,
    isReadyForSubmission,
    sourceMessageIds: userMessages.map((message) => message.id),
    sourceMessageText: cleanText(combinedText),
    type: draftType,
    context: {
      screenTitle: input.context.screenTitle,
      routeName: input.context.routeName,
      periodLabel: input.context.selectedPeriod?.label || null,
      platform: input.context.platform,
    },
    labels: getIssueLabels(draftType, input.context),
    shortDescription: getShortDescription(
      sourceTexts,
      input.context,
      featureArea,
    ),
  } satisfies HelpAssistantIssueFlowDraft;
}

function isIssueTriggerMessage(
  message: HelpAssistantMessage,
  context: HelpAssistantContext,
) {
  if (message.role !== "user") return false;

  const intent = getMessageIntent(message);
  if (getIssueTypeFromIntent(intent)) return true;

  const combined = cleanText(
    `${message.text} ${context.screenTitle} ${context.routeName}`,
  );
  const triggerType = getIssueTypeFromText(combined);
  if (!triggerType) return false;

  if (
    /^(kan ik|hoeveel ruimte|leg uit|waarom klopt|wat betekent|hoe werkt)/i.test(
      cleanText(message.text),
    )
  ) {
    return false;
  }

  return true;
}

function areDraftsEquivalent(
  left: HelpAssistantIssueFlowDraft | null,
  right: HelpAssistantIssueFlowDraft | null,
) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.activeDraftId === right.activeDraftId &&
    left.status === right.status &&
    left.signalType === right.signalType &&
    left.featureArea === right.featureArea &&
    left.userNeed === right.userNeed &&
    left.proposedChange === right.proposedChange &&
    left.summary === right.summary &&
    left.isReadyForSubmission === right.isReadyForSubmission &&
    left.sourceMessageText === right.sourceMessageText &&
    left.type === right.type &&
    left.context.screenTitle === right.context.screenTitle &&
    left.context.routeName === right.context.routeName &&
    left.context.periodLabel === right.context.periodLabel &&
    left.context.platform === right.context.platform &&
    left.labels.join("|") === right.labels.join("|") &&
    left.shortDescription === right.shortDescription &&
    left.sourceMessageIds.join("|") === right.sourceMessageIds.join("|")
  );
}

export function createInitialHelpAssistantIssueFlowState(): HelpAssistantIssueFlowState {
  return {
    status: "idle",
    activeDraft: null,
    anchorMessageId: null,
    errorMessage: null,
  };
}

export function isHelpAssistantIssueTriggerMessage(
  message: HelpAssistantMessage,
  context: HelpAssistantContext,
) {
  return isIssueTriggerMessage(message, context);
}

export function buildHelpAssistantIssueDraftPreview(
  thread: HelpAssistantThreadState,
  context: HelpAssistantContext,
  anchorMessageId: string,
  composerValue = "",
) {
  return buildDraftFromMessages({
    thread,
    context,
    anchorMessageId,
    composerValue,
  });
}

export function helpAssistantIssueFlowReducer(
  state: HelpAssistantIssueFlowState,
  action: HelpAssistantIssueFlowAction,
): HelpAssistantIssueFlowState {
  if (action.type === "reset") {
    return createInitialHelpAssistantIssueFlowState();
  }

  if (action.type === "cancel") {
    return {
      status: "cancelled",
      activeDraft: null,
      anchorMessageId: state.anchorMessageId,
      errorMessage: null,
    };
  }

  if (action.type === "request_submit") {
    if (
      !state.activeDraft ||
      state.status === "submitted" ||
      state.status === "cancelled"
    ) {
      return state;
    }
    return {
      ...state,
      status: "submitting",
      activeDraft: {
        ...state.activeDraft,
        status: "submitting",
      },
      errorMessage: null,
    };
  }

  if (action.type === "mark_submitted") {
    if (!state.activeDraft) return state;
    return {
      ...state,
      status: "submitted",
      activeDraft: {
        ...state.activeDraft,
        status: "submitted",
      },
      errorMessage: null,
    };
  }

  if (action.type === "mark_submit_failed") {
    if (!state.activeDraft) return state;
    return {
      ...state,
      status: "ready_to_review",
      activeDraft: {
        ...state.activeDraft,
        status: "ready_to_review",
      },
      errorMessage: action.errorMessage,
    };
  }

  const activeAnchorMessageId =
    action.anchorMessageId ||
    (state.anchorMessageId &&
    action.thread.messages.some((message) => message.id === state.anchorMessageId)
      ? state.anchorMessageId
      : null);

  if (!activeAnchorMessageId) {
    if (state.status === "submitting") return state;
    if (state.status === "submitted" || state.status === "cancelled") {
      return state;
    }
    return {
      ...state,
      status: "idle",
      activeDraft: null,
      anchorMessageId: null,
      errorMessage: null,
    };
  }

  if (state.status === "submitting") {
    return state;
  }

  const nextDraft = buildDraftFromMessages({
    thread: action.thread,
    context: action.context,
    anchorMessageId: activeAnchorMessageId,
    composerValue: action.composerValue || "",
    structuredResponse: action.structuredResponse || null,
  });

  if (!nextDraft) {
    if (
      state.status === "collecting" &&
      state.anchorMessageId === activeAnchorMessageId &&
      !state.activeDraft
    ) {
      return state;
    }

    return {
      ...state,
      status: "collecting",
      activeDraft: null,
      anchorMessageId: activeAnchorMessageId,
      errorMessage: null,
    };
  }

  const nextStatus: HelpAssistantIssueFlowStatus = nextDraft.isReadyForSubmission
    ? "ready_to_review"
    : state.status === "ready_to_review" && state.activeDraft
      ? "ready_to_review"
      : "collecting";
  const nextActiveDraft = {
    ...nextDraft,
    status: nextStatus,
    isReadyForSubmission:
      nextDraft.isReadyForSubmission || state.status === "ready_to_review",
  };

  if (areDraftsEquivalent(state.activeDraft, nextActiveDraft) && state.anchorMessageId === activeAnchorMessageId && state.status === nextStatus) {
    return state;
  }

  return {
    status: nextStatus,
    activeDraft: nextActiveDraft,
    anchorMessageId: activeAnchorMessageId,
    errorMessage: null,
  };
}
