import { describe, expect, it } from "vitest";

import {
  normalizeLegacyChatRequestToResponses,
  normalizeResponsesPayloadToLegacyChat,
} from "./openai-responses-adapter.ts";

describe("openai-responses-adapter", () => {
  it("maps legacy chat requests to responses requests", () => {
    const normalized = normalizeLegacyChatRequestToResponses({
      model: "gpt-5.4-nano",
      temperature: 0.2,
      max_tokens: 800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "budget_report",
          strict: true,
          schema: {
            type: "object",
          },
        },
      },
      messages: [
        { role: "system", content: "Je bent behulpzaam." },
        { role: "user", content: "Geef JSON terug." },
      ],
    });

    expect(normalized).toMatchObject({
      model: "gpt-5.4-nano",
      temperature: 0.2,
      max_output_tokens: 800,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "budget_report",
          strict: true,
          schema: {
            type: "object",
          },
        },
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "Je bent behulpzaam." }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: "Geef JSON terug." }],
        },
      ],
    });
    expect(normalized).not.toHaveProperty("messages");
    expect(normalized).not.toHaveProperty("response_format");
    expect(normalized).not.toHaveProperty("max_tokens");
  });

  it("maps responses payloads back to legacy chat shape", () => {
    const normalized = normalizeResponsesPayloadToLegacyChat({
      id: "resp_123",
      model: "gpt-5.4-nano",
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "{\"amount\":250}",
            },
          ],
        },
      ],
      usage: {
        input_tokens: 120,
        output_tokens: 40,
        total_tokens: 160,
      },
    });

    expect(normalized).toEqual({
      id: "resp_123",
      object: "chat.completion",
      model: "gpt-5.4-nano",
      usage: {
        prompt_tokens: 120,
        completion_tokens: 40,
        total_tokens: 160,
      },
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "{\"amount\":250}",
          },
        },
      ],
    });
  });

  it("maps max output truncation to a legacy length finish reason", () => {
    const normalized = normalizeResponsesPayloadToLegacyChat({
      id: "resp_456",
      model: "gpt-5.4-nano",
      incomplete_details: {
        reason: "max_output_tokens",
      },
      output: [],
    });

    expect(normalized?.choices[0]?.finish_reason).toBe("length");
  });
});
