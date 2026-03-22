import { createClient } from "@supabase/supabase-js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
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

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin client config ontbreekt voor OpenAI proxy.");
  }

  return createClient(url, serviceRoleKey, {
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
  for (const key of FORWARDED_HEADERS) {
    const value = headers.get(key);
    if (value) forwarded.set(key, value);
  }
  return forwarded;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return Response.json({ message: "Missing access token" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getAdminClient();
  const userResult = await supabaseAdmin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    return Response.json({ message: "Invalid authentication token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Invalid request body" }, { status: 400 });
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIKey()}`,
    },
    body: JSON.stringify(body),
  });

  const headers = pickForwardedHeaders(response.headers);
  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers,
  });
}
