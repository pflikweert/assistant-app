import { getDefaultAiModel } from "../ai-model-catalog.ts";
import { postOpenAIChatCompletion } from "../openai-proxy";

const DEFAULT_MODEL = getDefaultAiModel();
const OPENAI_RETRY_ATTEMPTS = 4;
const OPENAI_RETRY_BASE_DELAY_MS = 1_500;
const OPENAI_RETRY_MAX_DELAY_MS = 20_000;

export type CanonicalPdfTransaction = {
  date: string;
  details: string;
  amount: number;
  currency: string;
  counterparty: string;
  type: string;
  seq: number;
  metadata: Record<string, unknown>;
};

type OpenAIRequestError = Error & {
  status?: number;
  retryAfterMs?: number | null;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return Math.max(0, Math.ceil(asNumber * 1000));
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function getRetryDelayMs(attempt: number, error: OpenAIRequestError) {
  const withBackoff = Math.min(
    OPENAI_RETRY_MAX_DELAY_MS,
    OPENAI_RETRY_BASE_DELAY_MS * 2 ** attempt,
  );
  if (error.retryAfterMs == null) return withBackoff;
  return Math.max(withBackoff, error.retryAfterMs);
}

function isRetriableStatus(status?: number) {
  return status === 429 || (typeof status === "number" && status >= 500);
}

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || raw.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = candidate.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }
    throw new Error("AI-output bevat geen geldige JSON.");
  }
}

function normalizeTransaction(
  item: unknown,
  index: number,
): CanonicalPdfTransaction | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;

  const date = String(row.date ?? "").trim();
  const details = String(row.details ?? "").trim();
  const amount =
    typeof row.amount === "number" ? row.amount : Number(String(row.amount ?? ""));
  const currency = String(row.currency ?? "EUR").trim() || "EUR";
  const counterparty = String(row.counterparty ?? "").trim();
  const type = String(row.type ?? "").trim();
  const seqRaw = Number(row.seq);
  const seq = Number.isFinite(seqRaw) ? seqRaw : index + 1;
  const metadataValue = row.metadata;
  const metadata =
    metadataValue && typeof metadataValue === "object" && !Array.isArray(metadataValue)
      ? ({ ...metadataValue } as Record<string, unknown>)
      : {};

  if (!date || !details || !Number.isFinite(amount)) return null;

  return {
    date,
    details,
    amount,
    currency,
    counterparty,
    type,
    seq,
    metadata,
  };
}

function parseAndValidateAiPayload(content: string): CanonicalPdfTransaction[] {
  const payload = extractJsonObject(content);
  if (!payload || typeof payload !== "object") {
    throw new Error("AI-output is geen JSON-object.");
  }
  const transactions = (payload as Record<string, unknown>).transactions;
  if (!Array.isArray(transactions)) {
    throw new Error("AI-output mist veld 'transactions' als array.");
  }

  const normalized = transactions
    .map((item, index) => normalizeTransaction(item, index))
    .filter((item): item is CanonicalPdfTransaction => Boolean(item));

  if (!normalized.length) {
    throw new Error("AI-output bevat geen valide transacties in canoniek formaat.");
  }

  return normalized;
}

function buildPrompt(rawPdfText: string, deterministicRows: CanonicalPdfTransaction[]) {
  return [
    "Je bent een Rabobank PDF transactie-mapper.",
    "Geef ALLEEN strict JSON terug zonder markdown of extra tekst.",
    "Vorm: {\"transactions\":[{\"date\":\"YYYY-MM-DD\",\"details\":\"...\",\"amount\":number,\"currency\":\"EUR\",\"counterparty\":\"...\",\"type\":\"...\",\"seq\":number,\"metadata\":object}]}",
    "Gebruik lege string voor onbekende tekstvelden en {} voor metadata.",
    "Gebruik alleen feiten uit de input. Geen gegok.",
    "Input PDF tekst:",
    rawPdfText.slice(0, 24_000),
    "Deterministische voorparse (kan incompleet zijn):",
    JSON.stringify(deterministicRows.slice(0, 250)),
  ].join("\n\n");
}

async function requestOpenAI(prompt: string) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < OPENAI_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await postOpenAIChatCompletion({
        model: DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract Rabobank PDF transactions and return strict canonical JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }, {
        useCase: "import_pdf_mapping",
        agentMode: "extraction",
        responseMode: "json_object",
        fallbackEnabled: true,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(
          `OpenAI fout (${response.status}): ${errorText.slice(0, 500)}`,
        ) as OpenAIRequestError;
        err.status = response.status;
        err.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

        if (!isRetriableStatus(err.status)) throw err;
        lastError = err;
        if (attempt < OPENAI_RETRY_ATTEMPTS - 1) {
          await wait(getRetryDelayMs(attempt, err));
          continue;
        }
        throw err;
      }

      const json = await response.json();
      const content =
        json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || "";
      if (!content) {
        throw new Error("OpenAI gaf geen output terug voor PDF-mapping.");
      }
      return String(content);
    } catch (error: any) {
      const err = error as OpenAIRequestError;
      lastError = err;
      if (!isRetriableStatus(err.status) || attempt >= OPENAI_RETRY_ATTEMPTS - 1) {
        throw err;
      }
      await wait(getRetryDelayMs(attempt, err));
    }
  }

  throw lastError || new Error("OpenAI PDF-mapping faalde zonder foutdetail.");
}

export async function mapRabobankPdfTransactionsWithAI(input: {
  rawPdfText: string;
  deterministicRows: CanonicalPdfTransaction[];
}): Promise<CanonicalPdfTransaction[]> {
  const prompt = buildPrompt(input.rawPdfText, input.deterministicRows);
  const content = await requestOpenAI(prompt);

  try {
    return parseAndValidateAiPayload(content);
  } catch (error: any) {
    throw new Error(
      `Ongeldige AI-output voor PDF-transacties: ${error?.message || String(error)}`,
    );
  }
}
