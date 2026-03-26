import type { HelpAssistantContext } from "@/services/help-assistant-context";
import type {
  HelpAssistantQuickAction,
  HelpAssistantQuickActionId,
  HelpAssistantQuickActionIntent,
  HelpAssistantQuickActionTarget,
} from "@/services/help-assistant-quick-actions";

export type HelpAssistantMessageRole = "user" | "assistant";

export type HelpAssistantMessageSource =
  | "composer"
  | "quick_action"
  | "local_placeholder"
  | "ai_proxy";

export type HelpAssistantMessageStatus = "pending" | "ready" | "error";

export type HelpAssistantMessageMetadata = {
  source: HelpAssistantMessageSource;
  intent: HelpAssistantQuickActionIntent | "general_help";
  target: HelpAssistantQuickActionTarget | "general_help";
  quickActionId?: HelpAssistantQuickActionId;
  routeName: string;
  screenId: HelpAssistantContext["screenId"];
  screenTitle: string;
  periodLabel: string | null;
  platform: string;
  issueDraftCandidate: boolean;
  spendingAdviceCandidate: boolean;
  model?: string;
  errorCode?: string;
};

export type HelpAssistantMessage = {
  id: string;
  role: HelpAssistantMessageRole;
  status: HelpAssistantMessageStatus;
  text: string;
  createdAtIso: string;
  metadata: HelpAssistantMessageMetadata;
};

export type HelpAssistantThreadState = {
  messages: HelpAssistantMessage[];
  pendingIssueDraftIds: string[];
  pendingSpendingAdviceIds: string[];
};

type MessageTemplateInput = {
  text: string;
  role: HelpAssistantMessageRole;
  status: HelpAssistantMessageStatus;
  context: HelpAssistantContext;
  source: HelpAssistantMessageSource;
  intent: HelpAssistantMessageMetadata["intent"];
  target: HelpAssistantMessageMetadata["target"];
  quickActionId?: HelpAssistantQuickActionId;
};

type ApplyQuickActionResult = {
  thread: HelpAssistantThreadState;
  composerValue: string;
  userMessageId?: string;
  assistantPlaceholderId?: string;
};

export type ApplyComposerMessageResult = {
  thread: HelpAssistantThreadState;
  userMessageId?: string;
  assistantPlaceholderId?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function buildMessageId() {
  return `ha:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
}

function buildMessage({
  text,
  role,
  status,
  context,
  source,
  intent,
  target,
  quickActionId,
}: MessageTemplateInput): HelpAssistantMessage {
  const normalized = text.trim();

  return {
    id: buildMessageId(),
    role,
    status,
    text: normalized,
    createdAtIso: nowIso(),
    metadata: {
      source,
      intent,
      target,
      quickActionId,
      routeName: context.routeName,
      screenId: context.screenId,
      screenTitle: context.screenTitle,
      periodLabel: context.selectedPeriod?.label || null,
      platform: context.platform,
      issueDraftCandidate: target === "issue_draft",
      spendingAdviceCandidate: target === "spending_advice",
    },
  };
}

function buildLocalAssistantPlaceholder(
  context: HelpAssistantContext,
  intent: HelpAssistantMessageMetadata["intent"],
  target: HelpAssistantMessageMetadata["target"],
) {
  return buildMessage({
    text: "Dankjewel. Ik heb je bericht ontvangen en help je hier stap voor stap mee.",
    role: "assistant",
    status: "pending",
    context,
    source: "local_placeholder",
    intent,
    target,
  });
}

function appendMessage(
  thread: HelpAssistantThreadState,
  message: HelpAssistantMessage,
): HelpAssistantThreadState {
  return {
    messages: [...thread.messages, message],
    pendingIssueDraftIds: message.metadata.issueDraftCandidate
      ? [...thread.pendingIssueDraftIds, message.id]
      : thread.pendingIssueDraftIds,
    pendingSpendingAdviceIds: message.metadata.spendingAdviceCandidate
      ? [...thread.pendingSpendingAdviceIds, message.id]
      : thread.pendingSpendingAdviceIds,
  };
}

function appendLocalExchange(
  thread: HelpAssistantThreadState,
  userMessage: HelpAssistantMessage,
  context: HelpAssistantContext,
): {
  thread: HelpAssistantThreadState;
  assistantPlaceholderId: string;
} {
  const withUser = appendMessage(thread, userMessage);
  const assistantMessage = buildLocalAssistantPlaceholder(
    context,
    userMessage.metadata.intent,
    userMessage.metadata.target,
  );
  return {
    thread: appendMessage(withUser, assistantMessage),
    assistantPlaceholderId: assistantMessage.id,
  };
}

export function createInitialHelpAssistantThreadState(): HelpAssistantThreadState {
  return {
    messages: [],
    pendingIssueDraftIds: [],
    pendingSpendingAdviceIds: [],
  };
}

export function submitComposerMessageLocally(
  thread: HelpAssistantThreadState,
  context: HelpAssistantContext,
  rawText: string,
): ApplyComposerMessageResult {
  const normalized = rawText.trim();
  if (!normalized) return { thread };

  const userMessage = buildMessage({
    text: normalized,
    role: "user",
    status: "ready",
    context,
    source: "composer",
    intent: "general_help",
    target: "general_help",
  });

  const exchange = appendLocalExchange(thread, userMessage, context);
  return {
    thread: exchange.thread,
    userMessageId: userMessage.id,
    assistantPlaceholderId: exchange.assistantPlaceholderId,
  };
}

export function applyQuickActionLocally(
  thread: HelpAssistantThreadState,
  context: HelpAssistantContext,
  action: HelpAssistantQuickAction,
): ApplyQuickActionResult {
  if (action.behavior === "prefill_composer") {
    return {
      thread,
      composerValue: action.seedText,
    };
  }

  const userMessage = buildMessage({
    text: action.seedText,
    role: "user",
    status: "ready",
    context,
    source: "quick_action",
    intent: action.intent,
    target: action.target,
    quickActionId: action.id,
  });

  const exchange = appendLocalExchange(thread, userMessage, context);

  return {
    thread: exchange.thread,
    composerValue: "",
    userMessageId: userMessage.id,
    assistantPlaceholderId: exchange.assistantPlaceholderId,
  };
}

export function resolveAssistantMessageSuccess(
  thread: HelpAssistantThreadState,
  placeholderId: string,
  answerText: string,
  model?: string,
) {
  const normalized = answerText.trim();
  if (!normalized) return thread;

  return {
    ...thread,
    messages: thread.messages.map((message) => {
      if (message.id !== placeholderId) return message;
      if (message.role !== "assistant") return message;

      return {
        ...message,
        text: normalized,
        status: "ready" as const,
        metadata: {
          ...message.metadata,
          source: "ai_proxy" as const,
          model,
          errorCode: undefined,
        },
      };
    }),
  };
}

export function resolveAssistantMessageError(
  thread: HelpAssistantThreadState,
  placeholderId: string,
  messageText: string,
  errorCode = "proxy_error",
) {
  const fallback =
    messageText.trim() ||
    "Er ging iets mis bij het ophalen van een antwoord. Probeer het opnieuw.";

  return {
    ...thread,
    messages: thread.messages.map((message) => {
      if (message.id !== placeholderId) return message;
      if (message.role !== "assistant") return message;

      return {
        ...message,
        text: fallback,
        status: "error" as const,
        metadata: {
          ...message.metadata,
          errorCode,
        },
      };
    }),
  };
}
