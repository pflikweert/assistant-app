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

const query = String(process.argv[2] || "").trim().toLowerCase();

(async () => {
  const { data, error } = await supabase
    .from("categories")
    .select("id,key,name,parent_id")
    .order("name");

  if (error) throw error;

  const rows = data || [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const filtered = rows
    .filter((row) => {
      if (!query) return true;
      const text = `${row.key || ""} ${row.name || ""}`.toLowerCase();
      return text.includes(query);
    })
    .map((row) => {
      const names = [row.name];
      let current = row;
      const seen = new Set([row.id]);
      while (
        current.parent_id &&
        byId.has(current.parent_id) &&
        !seen.has(current.parent_id)
      ) {
        current = byId.get(current.parent_id);
        names.unshift(current.name);
        seen.add(current.id);
      }
      return {
        key: row.key,
        name: row.name,
        path: names.join(" > "),
      };
    });

  console.log(
    JSON.stringify(
      {
        query: query || null,
        count: filtered.length,
        results: filtered,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
