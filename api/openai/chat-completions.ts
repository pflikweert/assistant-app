import { createClient } from "@supabase/supabase-js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 25000;
const FORWARDED_HEADERS = [
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-tokens",
  "retry-after",
  "content-type",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SpendingAdviceSections = {
  conclusion: string;
  why: string;
  risk: string;
  nextStep: string;
  confidence?: string;
  dataGaps?: string[];
};

type HelpAssistantSpendingAdviceMeta = {
  useCase: "help_spending_advice";
  safeFallback?: SpendingAdviceSections;
};

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    throw new Error(
      "Supabase config ontbreekt voor OpenAI proxy (SUPABASE_URL + service role of anon key).",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is niet geconfigureerd op de server.");
  }
  return apiKey;
}

function pickForwardedHeaders(headers: Headers) {
  const forwarded = new Headers();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    forwarded.set(key, value);
  }
  for (const key of FORWARDED_HEADERS) {
    const value = headers.get(key);
    if (value) forwarded.set(key, value);
  }
  return forwarded;
}

function parseJsonSafely(value: unknown) {
  if (value instanceof Uint8Array) {
    try {
      const decoded = new TextDecoder().decode(value);
      return decoded ? JSON.parse(decoded) : null;
    } catch {
      return null;
    }
  }
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOpenAIProxyEnvelope(body: unknown): {
  openaiPayload: Record<string, unknown> | null;
  meta: HelpAssistantSpendingAdviceMeta | null;
} {
  if (!isRecord(body)) {
    return { openaiPayload: null, meta: null };
  }

  const maybeOpenAI = body.openai;
  const maybeMeta = body.meta;
  if (!maybeOpenAI) {
    return { openaiPayload: body, meta: null };
  }

  const openaiPayload = isRecord(maybeOpenAI) ? maybeOpenAI : null;
  const meta =
    isRecord(maybeMeta) && maybeMeta.useCase === "help_spending_advice"
      ? (maybeMeta as HelpAssistantSpendingAdviceMeta)
      : null;

  return { openaiPayload, meta };
}

function parseSpendingAdviceSchema(content: string): SpendingAdviceSections | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const directCandidates = [trimmed];
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) directCandidates.push(fenceMatch[1].trim());

  for (const candidate of directCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const conclusion = String(parsed.conclusion || "").trim();
      const why = String(parsed.why || "").trim();
      const risk = String(parsed.risk || "").trim();
      const nextStep = String(parsed.nextStep || "").trim();
      if (!conclusion || !why || !risk || !nextStep) continue;

      const confidence = String(parsed.confidence || "").trim() || undefined;
      const dataGaps = Array.isArray(parsed.dataGaps)
        ? parsed.dataGaps
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        : undefined;

      return {
        conclusion,
        why,
        risk,
        nextStep,
        confidence,
        dataGaps: dataGaps?.length ? dataGaps : undefined,
      };
    } catch {
      // ignore and continue
    }
  }

  return null;
}

function buildSafeFallbackSections(
  fallback: SpendingAdviceSections | undefined,
): SpendingAdviceSections {
  if (fallback && fallback.conclusion && fallback.why && fallback.risk && fallback.nextStep) {
    return fallback;
  }

  return {
    conclusion: "Ik kan je bestedingsruimte nu niet betrouwbaar bevestigen.",
    why:
      "De adviesberekening via de AI-proxy is op dit moment niet stabiel genoeg voor een scherpe conclusie.",
    risk:
      "Op basis van wat ik nu zie kan ik anders te veel schijnzekerheid geven.",
    nextStep:
      "Open Budget of Inzichten en probeer je vraag opnieuw met bedrag en categorie.",
    confidence: "laag",
    dataGaps: ["proxy_of_schema_fout"],
  };
}

function buildSyntheticSpendingChatCompletion(
  sections: SpendingAdviceSections,
  idSuffix: string,
) {
  return {
    id: `chatcmpl-help-safe-${idSuffix}`,
    object: "chat.completion",
    model: "proxy-safe-fallback-spending-v1",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify(sections),
        },
      },
    ],
  };
}

function readOpenAIMessageContent(payload: unknown) {
  if (!isRecord(payload)) return "";
  const choices = payload.choices;
  if (!Array.isArray(choices) || !choices.length) return "";
  const first = choices[0];
  if (!isRecord(first)) return "";
  const message = first.message;
  if (!isRecord(message)) return "";
  return String(message.content || "").trim();
}

function respondWithSpendingFallback(
  res: any,
  fallback: SpendingAdviceSections | undefined,
  idSuffix: string,
) {
  res.status(200);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(
    JSON.stringify(
      buildSyntheticSpendingChatCompletion(
        buildSafeFallbackSections(fallback),
        idSuffix,
      ),
    ),
  );
}

export default async function handler(req: any, res: any) {
  let spendingMeta: HelpAssistantSpendingAdviceMeta | null = null;
  try {
    if (req.method === "OPTIONS") {
      res.status(204);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ message: "Method not allowed" });
      return;
    }

    const authHeader = String(req.headers.authorization ?? "");
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      res.status(401);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ message: "Missing access token" });
      return;
    }

    const token = authHeader.slice(7);
    const supabaseClient = getSupabaseAuthClient();
    const userResult = await supabaseClient.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      res.status(401);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ message: "Invalid authentication token" });
      return;
    }

    const body = parseJsonSafely(req.body);
    const { openaiPayload, meta } = parseOpenAIProxyEnvelope(body);
    spendingMeta = meta;

    if (!openaiPayload) {
      res.status(400);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ message: "Invalid request body" });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getOpenAIKey()}`,
        },
        body: JSON.stringify(openaiPayload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseBody = await response.text();

    if (spendingMeta?.useCase === "help_spending_advice") {
      if (!response.ok) {
        respondWithSpendingFallback(
          res,
          spendingMeta.safeFallback,
          `http-${response.status}`,
        );
        return;
      }

      const parsed = parseJsonSafely(responseBody);
      const content = readOpenAIMessageContent(parsed);
      const schema = parseSpendingAdviceSchema(content);
      if (!schema) {
        respondWithSpendingFallback(res, spendingMeta.safeFallback, "schema");
        return;
      }

      res.status(200);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");
      res.send(
        JSON.stringify(
          isRecord(parsed)
            ? parsed
            : buildSyntheticSpendingChatCompletion(schema, "normalized"),
        ),
      );
      return;
    }

    const headers = pickForwardedHeaders(response.headers);
    headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).send(responseBody);
  } catch (error) {
    if (spendingMeta?.useCase === "help_spending_advice") {
      respondWithSpendingFallback(res, spendingMeta.safeFallback, "catch");
      return;
    }

    const message =
      error instanceof Error ? error.message : "OpenAI proxy onverwachte fout";
    res.status(500);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ message });
  }
}
