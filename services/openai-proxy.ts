import Constants from "expo-constants";
import { supabase } from "./supabase";

const OPENAI_PROXY_PATH = "/api/openai/chat-completions";

function getBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const extra =
    Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const configuredBaseUrl =
    extra?.APP_BASE_URL || process.env.APP_BASE_URL || process.env.SITE_URL;

  return configuredBaseUrl?.trim() || null;
}

export async function postOpenAIChatCompletion(body: unknown) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Je sessie is verlopen. Log opnieuw in om AI-functies te gebruiken.");
  }

  const baseUrl = getBaseUrl();
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
