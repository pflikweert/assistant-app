import { createClient } from "@supabase/supabase-js";

const getAdminClient = () => {
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
};

type ResetPayload = {
  method?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ message: "Missing access token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);
  const supabaseAdmin = getAdminClient();
  const userResult = await supabaseAdmin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    return new Response(
      JSON.stringify({ message: "Invalid authentication token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const payload = await request.json().catch(() => ({} as ResetPayload));
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const insertResult = await supabaseAdmin
    .from("password_reset_events")
    .insert({
      user_id: userResult.data.user.id,
      method: typeof payload.method === "string" ? payload.method : "recovery_email",
      ip,
      metadata:
        payload.metadata && typeof payload.metadata === "object"
          ? payload.metadata
          : null,
    })
    .select("id")
    .maybeSingle();

  if (insertResult.error) {
    return new Response(
      JSON.stringify({ message: insertResult.error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(null, { status: 204 });
}
