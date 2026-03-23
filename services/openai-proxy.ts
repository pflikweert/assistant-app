import { getSession } from "./supabase";
import { getApiBaseUrl } from "./api-base";

const OPENAI_PROXY_PATH = "/api/openai/chat-completions";

export async function postOpenAIChatCompletion(body: unknown) {
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
