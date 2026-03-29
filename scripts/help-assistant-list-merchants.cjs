require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!process.env.SUPABASE_URL || !serviceRoleKey) {
  console.error("SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt.");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, serviceRoleKey, {
  auth: { persistSession: false },
});

const userId =
  process.argv[2] ||
  process.env.DEV_AUTH_USER_ID ||
  "08c9f32b-ed7b-45d6-94b5-bb2fefadc89c";
const startIso = process.argv[3] || "2025-01-01";
const endIsoExclusive = process.argv[4] || "2026-04-01";
const limit = Number.parseInt(process.argv[5] || "50", 10);

(async () => {
  const { data, error } = await supabase
    .from("transactions")
    .select("counterparty, amount, date")
    .eq("user_id", userId)
    .gte("date", startIso)
    .lt("date", endIsoExclusive)
    .limit(5000);

  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    const name = String(row.counterparty || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = map.get(key) || { name, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Math.abs(Number(row.amount || 0));
    if (name.length < entry.name.length) entry.name = name;
    map.set(key, entry);
  }

  const top = [...map.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50);

  console.log(
    JSON.stringify(
      {
        userId,
        startIso,
        endIsoExclusive,
        merchants: top,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
