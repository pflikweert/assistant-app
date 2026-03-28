import {
  createDevSession,
  getSession,
  isDevAuthBypassEnabled,
  supabase,
} from "./supabase";
import { getApiBaseUrl } from "./api-base";
import type { AiProxyMeta } from "./ai-use-cases";

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
  const resolveAccessToken = async () => {
    let session = await getSession();

    // Refresh shortly before token expiry so we avoid noisy 401 retries.
    const nowEpoch = Math.floor(Date.now() / 1000);
    const isNearlyExpired =
      session?.expires_at != null && session.expires_at - nowEpoch <= 45;
    if (isNearlyExpired) {
      const refresh = await supabase.auth.refreshSession().catch(() => null);
      if (refresh?.data?.session) {
        session = refresh.data.session;
      }
    }

    if (session?.access_token) return session.access_token;
    if (isDevAuthBypassEnabled) {
      return createDevSession()?.access_token ?? null;
    }
    return null;
  };

  let accessToken = await resolveAccessToken();
  if (!accessToken) {
    throw new Error("Je sessie is verlopen. Log opnieuw in om AI-functies te gebruiken.");
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Kan de API-locatie niet bepalen voor OpenAI-aanroepen.");
  }

  const proxyUrl = new URL(OPENAI_PROXY_PATH, baseUrl).toString();
  const sendRequest = (token: string) =>
    fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  let response = await sendRequest(accessToken);
  if (response.status === 401) {
    const refresh = await supabase.auth.refreshSession().catch(() => null);
    const refreshedToken = refresh?.data?.session?.access_token || null;
    if (refreshedToken && refreshedToken !== accessToken) {
      accessToken = refreshedToken;
      response = await sendRequest(accessToken);
    }
  }

  return response;
}

export async function postOpenAIChatCompletion(
  body: unknown,
  meta?: AiProxyMeta,
) {
  return postOpenAIProxy(meta ? { openai: body, meta } : body);
}

export async function postHelpAssistantSpendingAdviceCompletion(input: {
  openAIRequest: unknown;
  safeFallback: SpendingAdviceProxyFallback;
  meta?: AiProxyMeta;
}) {
  return postOpenAIProxy({
    openai: input.openAIRequest,
    meta: {
      ...(input.meta || {}),
      useCase: "help_spending_advice",
      safeFallback: input.safeFallback,
    },
  });
}
