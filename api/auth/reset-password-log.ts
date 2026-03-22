import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "service role key or supabase url is missing for reset-password-log",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(req: any, res: any) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const authHeader = String(req.headers.authorization ?? "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ message: "Missing access token" });
    return;
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getAdminClient();
  const userResult = await supabaseAdmin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    res.status(401).json({ message: "Invalid authentication token" });
    return;
  }

  const payload =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};
  const ip =
    String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() ||
    String(req.headers["x-real-ip"] ?? "") ||
    null;

  const insertResult = await supabaseAdmin
    .from("password_reset_events")
    .insert({
      user_id: userResult.data.user.id,
      method:
        typeof payload.method === "string" ? payload.method : "recovery_email",
      ip,
      metadata:
        payload.metadata && typeof payload.metadata === "object"
          ? payload.metadata
          : null,
    })
    .select("id")
    .maybeSingle();

  if (insertResult.error) {
    res.status(500).json({ message: insertResult.error.message });
    return;
  }

  res.status(204).end();
}
