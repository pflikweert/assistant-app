import { getApiBaseUrl } from "@/services/api-base";
import { getSession } from "@/services/supabase";

type AdminApiJson = {
  error?: string;
};

function parseJsonSafely(text: string) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as AdminApiJson;
  } catch {
    return {};
  }
}

async function getAdminAuthHeaders() {
  const session = await getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Je sessie is verlopen. Log opnieuw in om Budio beheer te openen.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function fetchAdminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Kan de API-locatie niet bepalen voor Budio beheer.");
  }

  const response = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(await getAdminAuthHeaders()),
    },
  });

  const text = await response.text();
  const parsed = parseJsonSafely(text) as T & AdminApiJson;

  if (!response.ok) {
    throw new Error(
      parsed && typeof parsed.error === "string" && parsed.error
        ? parsed.error
        : `Budio beheer request mislukt (${response.status}).`,
    );
  }

  return parsed as T;
}

export async function fetchAdminBootstrap<T>() {
  return fetchAdminJson<T>("/api/admin");
}
