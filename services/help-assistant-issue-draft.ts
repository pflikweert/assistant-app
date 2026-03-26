import type { HelpAssistantMessage } from "@/services/help-assistant-chat";
import type { HelpAssistantContext } from "@/services/help-assistant-context";
import type { HelpAssistantClassifiedIntent } from "@/services/help-assistant-intent";

export type HelpAssistantIssueDraftType = "bug" | "feedback" | "feature_request";

export type HelpAssistantIssueDraftPreview = {
  sourceMessageId: string;
  sourceMessageText: string;
  type: HelpAssistantIssueDraftType;
  summary: string;
  chatSummary: string;
  confirmationPrompt: string;
  clarificationPrompt: string | null;
  context: {
    screenTitle: string;
    routeName: string;
    periodLabel: string | null;
    platform: string;
  };
  labels: string[];
  shortDescription: string;
};

export type HelpAssistantIssueDraftAction = "confirm" | "dismiss" | null;

function cleanInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function lowerFirst(value: string) {
  if (!value) return value;
  return `${value[0]?.toLowerCase() || ""}${value.slice(1)}`;
}

function capitalizeFirst(value: string) {
  const trimmed = cleanInlineText(value);
  if (!trimmed) return trimmed;
  return `${trimmed[0]?.toUpperCase() || ""}${trimmed.slice(1)}`;
}

function formatSentenceFragment(value: string) {
  const trimmed = cleanInlineText(value);
  if (!trimmed) return trimmed;
  if (/^(Een|De|Het|Ik|Mijn|We|Wij|Jij|Je|Jullie|U)\b/.test(trimmed)) {
    return lowerFirst(trimmed);
  }
  return trimmed;
}

function stripLeadingIntentPhrases(value: string) {
  let result = cleanInlineText(value)
    .replace(/[.!?]+$/, "")
    .trim();

  const patterns = [
    /^ik heb een idee voor\s+/i,
    /^ik heb een idee over\s+/i,
    /^ik heb een idee\s+/i,
    /^ik heb een suggestie voor\s+/i,
    /^ik heb feedback over\s+/i,
    /^ik wil graag dat\s+/i,
    /^ik wil graag\s+/i,
    /^ik wil\s+/i,
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

  return cleanInlineText(result);
}

function toIssueType(intent: HelpAssistantClassifiedIntent): HelpAssistantIssueDraftType | null {
  if (intent === "mogelijke_bug") return "bug";
  if (intent === "feedback") return "feedback";
  if (intent === "feature_request") return "feature_request";
  return null;
}

function buildSummary(type: HelpAssistantIssueDraftType, messageText: string) {
  const normalized = stripLeadingIntentPhrases(messageText).slice(0, 92);
  if (!normalized) {
    if (type === "bug") return "Probleem dat nagekeken moet worden";
    if (type === "feedback") return "Feedback voor Budio";
    return "Idee voor Budio";
  }
  return capitalizeFirst(normalized);
}

function buildChatSummary(
  type: HelpAssistantIssueDraftType,
  summary: string,
  screenTitle: string,
) {
  const fragment = formatSentenceFragment(summary);

  if (type === "bug") {
    return `Volgens mij gaat er iets mis met ${fragment}. Klopt dat?`;
  }

  if (type === "feedback") {
    if (summary.length <= 24) {
      return `Volgens mij heb je feedback over ${fragment}. Klopt dat?`;
    }
    return `Volgens mij wil je ${fragment}. Klopt dat?`;
  }

  if (type === "feature_request") {
    if (summary.length <= 24) {
      return `Volgens mij heb je een idee voor ${fragment}. Klopt dat?`;
    }
    return `Volgens mij wil je ${fragment}. Klopt dat?`;
  }

  return `Volgens mij gaat het om ${fragment || screenTitle.toLowerCase()}. Klopt dat?`;
}

function buildClarificationPrompt(messageText: string) {
  const stripped = stripLeadingIntentPhrases(messageText);
  if (!stripped || stripped.length < 18) {
    return "Als je wilt, kun je het nog iets concreter maken.";
  }
  if (/^(idee|suggestie|bug|fout|probleem)$/i.test(stripped)) {
    return "Kun je iets meer vertellen wat je precies bedoelt?";
  }
  return null;
}

function normalizeActionText(value: string) {
  return cleanInlineText(value).toLowerCase().replace(/[.!?]+$/g, "");
}

const CONFIRM_ACTION_PATTERNS = [
  /^(ja|jazeker|zeker|prima|goed|doe maar|verstuur maar|stuur maar door|meld maar)$/,
  /^ja,\s*stuur maar door$/,
  /\bstuur maar door\b/,
  /\bverstuur maar\b/,
  /\bmeld maar\b/,
  /\bdoe maar\b/,
  /\bja graag\b/,
];

const DISMISS_ACTION_PATTERNS = [
  /^(nee|nee bedankt|laat maar|niet nodig|hoeft niet|vergeet het|annuleer(?: maar)?)$/,
  /\blaat maar\b/,
  /\bhoeft niet\b/,
  /\bniet nodig\b/,
];

export function resolveHelpAssistantIssueDraftAction(
  value: string,
): HelpAssistantIssueDraftAction {
  const normalized = normalizeActionText(value);
  if (!normalized) return null;

  if (CONFIRM_ACTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "confirm";
  }

  if (
    normalized.startsWith("ja") &&
    (normalized.includes("stuur") ||
      normalized.includes("meld") ||
      normalized.includes("verstuur") ||
      normalized.includes("doe maar"))
  ) {
    return "confirm";
  }

  if (DISMISS_ACTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "dismiss";
  }

  if (normalized.startsWith("nee") && normalized.includes("laat maar")) {
    return "dismiss";
  }

  return null;
}

export function buildIssueDraftPreview(input: {
  message: HelpAssistantMessage;
  context: HelpAssistantContext;
}): HelpAssistantIssueDraftPreview | null {
  const issueType = toIssueType(
    input.message.metadata.classification?.intent || "uitlegvraag",
  );
  if (!issueType) return null;

  const summary = buildSummary(issueType, input.message.text);
  const chatSummary = buildChatSummary(
    issueType,
    summary,
    input.context.screenTitle,
  );
  const periodLabel = input.context.selectedPeriod?.label || null;
  const labels = [
    "source:help-assistant",
    `type:${issueType === "feature_request" ? "feature" : issueType}`,
    `screen:${input.context.screenId}`,
  ];

  const shortDescription = [
    `Gebruikersmelding op ${input.context.screenTitle}:`,
    cleanInlineText(input.message.text),
    "",
    `Context: route ${input.context.routeName}, periode ${periodLabel || "niet geselecteerd"}, platform ${input.context.platform}.`,
  ]
    .join("\n")
    .trim();

  return {
    sourceMessageId: input.message.id,
    sourceMessageText: cleanInlineText(input.message.text),
    type: issueType,
    summary,
    chatSummary,
    confirmationPrompt: "Klopt dit? Wil je dat ik dit meld aan Budio?",
    clarificationPrompt: buildClarificationPrompt(input.message.text),
    context: {
      screenTitle: input.context.screenTitle,
      routeName: input.context.routeName,
      periodLabel,
      platform: input.context.platform,
    },
    labels,
    shortDescription,
  };
}
