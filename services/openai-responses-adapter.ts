type LegacyChatMessage = {
  role?: string;
  content?: unknown;
};

type LegacyResponseFormat =
  | {
      type?: string;
      json_schema?: {
        name?: string;
        strict?: boolean;
        schema?: Record<string, unknown>;
      };
    }
  | null
  | undefined;

type ResponsesTextFormat =
  | { type: "text" }
  | { type: "json_object" }
  | {
      type: "json_schema";
      name?: string;
      strict?: boolean;
      schema?: Record<string, unknown>;
    };

export type LegacyChatCompletionLikeResponse = {
  id?: string;
  object?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: "assistant";
      content: string;
    };
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toResponsesInputMessage(message: LegacyChatMessage) {
  return {
    role: String(message.role || "user"),
    content: [
      {
        type: "input_text",
        text:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? ""),
      },
    ],
  };
}

function toResponsesTextFormat(responseFormat: LegacyResponseFormat): ResponsesTextFormat {
  const formatType = String(responseFormat?.type || "").trim();

  if (formatType === "json_object") {
    return { type: "json_object" };
  }

  if (formatType === "json_schema") {
    return {
      type: "json_schema",
      name: responseFormat?.json_schema?.name,
      strict: responseFormat?.json_schema?.strict,
      schema: responseFormat?.json_schema?.schema,
    };
  }

  return { type: "text" };
}

export function normalizeLegacyChatRequestToResponses(
  request: Record<string, unknown>,
) {
  const payload = { ...request };
  const responseFormat = isRecord(payload.response_format)
    ? (payload.response_format as LegacyResponseFormat)
    : null;
  const messages = Array.isArray(payload.messages)
    ? (payload.messages as LegacyChatMessage[])
    : [];

  delete payload.response_format;
  delete payload.messages;

  const normalized: Record<string, unknown> = {
    ...payload,
    store: false,
    input: messages.map(toResponsesInputMessage),
    text: {
      format: toResponsesTextFormat(responseFormat),
    },
  };

  if ("max_tokens" in normalized) {
    normalized.max_output_tokens = normalized.max_tokens;
    delete normalized.max_tokens;
  }

  return normalized;
}

function extractResponsesOutputText(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    if (!isRecord(item) || item.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!isRecord(part)) continue;
      if (part.type === "output_text") {
        const text = String(part.text || "").trim();
        if (text) textParts.push(text);
      }
      if (part.type === "refusal") {
        const refusal = String(part.refusal || "").trim();
        if (refusal) textParts.push(refusal);
      }
    }
  }

  return textParts.join("\n\n").trim();
}

function toLegacyFinishReason(payload: Record<string, unknown>) {
  const incomplete = isRecord(payload.incomplete_details)
    ? payload.incomplete_details
    : null;
  const reason = String(incomplete?.reason || "").trim();

  if (reason === "max_output_tokens") return "length";
  if (reason) return reason;
  return "stop";
}

export function normalizeResponsesPayloadToLegacyChat(
  payload: unknown,
): LegacyChatCompletionLikeResponse | null {
  if (!isRecord(payload)) return null;

  const usage = isRecord(payload.usage) ? payload.usage : null;

  return {
    id: String(payload.id || ""),
    object: "chat.completion",
    model: String(payload.model || ""),
    usage: usage
      ? {
          prompt_tokens: Number(usage.input_tokens || 0),
          completion_tokens: Number(usage.output_tokens || 0),
          total_tokens: Number(usage.total_tokens || 0),
        }
      : undefined,
    choices: [
      {
        index: 0,
        finish_reason: toLegacyFinishReason(payload),
        message: {
          role: "assistant",
          content: extractResponsesOutputText(payload),
        },
      },
    ],
  };
}
