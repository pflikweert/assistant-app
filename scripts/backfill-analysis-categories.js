require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

function isCareCategoryKey(categoryKey) {
  return (
    categoryKey === "care" ||
    categoryKey === "health" ||
    categoryKey.startsWith("care_") ||
    categoryKey.startsWith("health_")
  );
}

function isCareInsuranceCategoryKey(categoryKey) {
  return (
    categoryKey.startsWith("care_health_insurance") ||
    categoryKey.startsWith("insurance_health") ||
    categoryKey.startsWith("health_insurance")
  );
}

function isSavingsCategoryKey(categoryKey) {
  return (
    categoryKey === "savings" ||
    categoryKey === "savings_transfer" ||
    categoryKey.startsWith("savings_")
  );
}

function isSubscriptionCategoryKey(categoryKey) {
  return (
    categoryKey === "subscriptions" ||
    categoryKey.startsWith("subscriptions_") ||
    categoryKey.startsWith("subscription_")
  );
}

function resolveFromCategory(categoryKey, budgetGroup) {
  if (isSavingsCategoryKey(categoryKey) || budgetGroup === "savings")
    return "savings_transfer";
  if (isSubscriptionCategoryKey(categoryKey)) return "subscriptions";

  const isCareInsurance = isCareInsuranceCategoryKey(categoryKey);
  const isCareOther = isCareCategoryKey(categoryKey) && !isCareInsurance;
  if (isCareOther) return "variable_costs";

  if (
    categoryKey.startsWith("housing") ||
    isCareInsurance ||
    categoryKey.startsWith("auto_transport_car_insurance") ||
    categoryKey.startsWith("auto_transport_road_tax")
  ) {
    return "fixed_costs";
  }

  if (budgetGroup === "fixed") return "fixed_costs";
  if (budgetGroup === "variable") return "variable_costs";

  return null;
}

async function updateByCategoryIds(categoryIds, analysisCategory, nowIso) {
  if (!categoryIds.length) return { user: 0, auto: 0 };

  const payload = {
    analysis_main_group: "expense",
    analysis_category: analysisCategory,
    analysis_updated_at: nowIso,
    updated_at: nowIso,
  };

  const userRes = await supabase
    .from("transactions")
    .update(payload)
    .lt("amount", 0)
    .in("category_id_user", categoryIds)
    .select("id");
  if (userRes.error) throw userRes.error;

  const autoRes = await supabase
    .from("transactions")
    .update(payload)
    .lt("amount", 0)
    .is("category_id_user", null)
    .in("category_id_auto", categoryIds)
    .select("id");
  if (autoRes.error) throw autoRes.error;

  return {
    user: (userRes.data || []).length,
    auto: (autoRes.data || []).length,
  };
}

(async () => {
  const nowIso = new Date().toISOString();

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id,key,budget_group")
    .limit(5000);
  if (categoriesError) throw categoriesError;

  const byTarget = {
    savings_transfer: [],
    subscriptions: [],
    fixed_costs: [],
    variable_costs: [],
  };

  for (const row of categories || []) {
    const id = String(row.id);
    const key = String(row.key || "");
    const budgetGroup =
      row.budget_group == null ? null : String(row.budget_group);
    const target = resolveFromCategory(key, budgetGroup);
    if (target) byTarget[target].push(id);
  }

  const stats = {};
  for (const target of [
    "savings_transfer",
    "subscriptions",
    "fixed_costs",
    "variable_costs",
  ]) {
    const res = await updateByCategoryIds(byTarget[target], target, nowIso);
    stats[target] = {
      categories: byTarget[target].length,
      updatedUserRows: res.user,
      updatedAutoRows: res.auto,
      updatedTotal: res.user + res.auto,
    };
  }

  const { data: postSummary, error: postError } = await supabase
    .from("transactions")
    .select("analysis_category,amount")
    .lt("amount", 0)
    .gte("date", "2026-01-01")
    .lt("date", "2026-04-01")
    .limit(10000);
  if (postError) throw postError;

  const distribution = {};
  for (const row of postSummary || []) {
    const key = row.analysis_category || "null";
    distribution[key] = (distribution[key] || 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        stats,
        q1NegativeTxAnalysisDistribution: distribution,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
});
