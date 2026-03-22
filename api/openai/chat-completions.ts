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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    forwarded.set(key, value);
  }
  for (const key of FORWARDED_HEADERS) {
    const value = headers.get(key);
    if (value) forwarded.set(key, value);
  }
  return forwarded;
}

export default async function handler(req: any, res: any) {
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
  const supabaseAdmin = getAdminClient();
  const userResult = await supabaseAdmin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    res.status(401);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ message: "Invalid authentication token" });
    return;
  }

  const body =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return null;
          }
        })()
      : req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ message: "Invalid request body" });
    return;
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
  headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.setHeader("Access-Control-Allow-Origin", "*");

  const responseBody = await response.text();
  res.status(response.status).send(responseBody);
}
