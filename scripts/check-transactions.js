// simple script to list recent transactions
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("missing supabase env");
  process.exit(1);
}
const supabase = createClient(url, anonKey);
async function run() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(10);
  if (error) {
    console.error("error", error);
  } else {
    console.log("rows", data);
  }
}
run();
