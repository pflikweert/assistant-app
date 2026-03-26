import { getSession } from "./supabase";
import { getApiBaseUrl } from "./api-base";

const OPENAI_PROXY_PATH = "/api/openai/chat-completions";

export type SpendingAdviceProxyFallback = {
  conclusion: string;
  why: string;
  risk: string;
  nextStep: string;
  confidence?: string;
  dataGaps?: string[];
};

async function postOpenAIProxy(body: unknown) {
  const session = await getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Je sessie is verlopen. Log opnieuw in om AI-functies te gebruiken.");
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Kan de API-locatie niet bepalen voor OpenAI-aanroepen.");
  }

  const response = await fetch(new URL(OPENAI_PROXY_PATH, baseUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  return response;
}

export async function postOpenAIChatCompletion(body: unknown) {
  return postOpenAIProxy(body);
}

export async function postHelpAssistantSpendingAdviceCompletion(input: {
  openAIRequest: unknown;
  safeFallback: SpendingAdviceProxyFallback;
}) {
  return postOpenAIProxy({
    openai: input.openAIRequest,
    meta: {
      useCase: "help_spending_advice",
      safeFallback: input.safeFallback,
    },
  });
}
