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

function resolveExpectedFromCategory(categoryKey, budgetGroup) {
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

function effectiveCategoryId(tx) {
  return tx.category_id_user || tx.category_id_auto || null;
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

(async () => {
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id,key,name,budget_group")
    .limit(5000);
  if (categoriesError) throw categoriesError;

  const categoryById = new Map(
    (categories || []).map((c) => [
      String(c.id),
      {
        key: String(c.key || ""),
        name: String(c.name || ""),
        budget_group: c.budget_group == null ? null : String(c.budget_group),
      },
    ]),
  );

  const { data: txRows, error: txError } = await supabase
    .from("transactions")
    .select(
      "id,date,amount,details,counterparty,analysis_category,category_id_auto,category_id_user",
    )
    .lt("amount", 0)
    .gte("date", "2026-01-01")
    .lt("date", "2026-04-01")
    .order("date", { ascending: false })
    .limit(10000);
  if (txError) throw txError;

  const rows = txRows || [];

  const savingsSummary = {
    total: 0,
    byAnalysisCategory: {},
    mismatches: 0,
  };

  const allowanceSummary = {
    total: 0,
    byAnalysisCategory: {},
    mismatches: 0,
  };

  const textHintSummary = {
    savingsKeywordRows: 0,
    savingsKeywordAsSavingsTransfer: 0,
    allowanceKeywordRows: 0,
    allowanceKeywordAsVariable: 0,
  };

  const mismatchSamples = [];

  for (const tx of rows) {
    const catId = effectiveCategoryId(tx);
    const category = catId ? categoryById.get(String(catId)) || null : null;
    const categoryKey = category ? category.key : "";
    const budgetGroup = category ? category.budget_group : null;
    const expected = resolveExpectedFromCategory(categoryKey, budgetGroup);
    const current = tx.analysis_category || null;

    if (isSavingsCategoryKey(categoryKey) || budgetGroup === "savings") {
      savingsSummary.total += 1;
      const key = current || "null";
      savingsSummary.byAnalysisCategory[key] =
        (savingsSummary.byAnalysisCategory[key] || 0) + 1;
      if (current !== "savings_transfer") savingsSummary.mismatches += 1;
    }

    if (
      categoryKey === "children_allowance" ||
      categoryKey === "children_clothing_allowance"
    ) {
      allowanceSummary.total += 1;
      const key = current || "null";
      allowanceSummary.byAnalysisCategory[key] =
        (allowanceSummary.byAnalysisCategory[key] || 0) + 1;
      if (current !== "variable_costs") allowanceSummary.mismatches += 1;
    }

    const haystack = `${normalizeText(tx.counterparty)} ${normalizeText(tx.details)}`;
    const hasSavingsKeyword =
      haystack.includes("spaar") ||
      haystack.includes("sparen") ||
      haystack.includes("belegging") ||
      haystack.includes("invest");
    const hasAllowanceKeyword =
      haystack.includes("zakgeld") || haystack.includes("kleedgeld");

    if (hasSavingsKeyword) {
      textHintSummary.savingsKeywordRows += 1;
      if (current === "savings_transfer") {
        textHintSummary.savingsKeywordAsSavingsTransfer += 1;
      }
    }

    if (hasAllowanceKeyword) {
      textHintSummary.allowanceKeywordRows += 1;
      if (current === "variable_costs") {
        textHintSummary.allowanceKeywordAsVariable += 1;
      }
    }

    if (expected && current !== expected && mismatchSamples.length < 25) {
      mismatchSamples.push({
        id: String(tx.id),
        date: String(tx.date),
        amount: Number(tx.amount),
        counterparty: String(tx.counterparty || ""),
        details: String(tx.details || "").slice(0, 120),
        categoryKey,
        budgetGroup,
        currentAnalysisCategory: current,
        expectedAnalysisCategory: expected,
      });
    }
  }

  const strictCheckedRows = rows.filter((tx) => {
    const catId = effectiveCategoryId(tx);
    const category = catId ? categoryById.get(String(catId)) || null : null;
    if (!category) return false;
    return (
      resolveExpectedFromCategory(category.key, category.budget_group) != null
    );
  });

  const strictMismatches = strictCheckedRows.filter((tx) => {
    const catId = effectiveCategoryId(tx);
    const category = categoryById.get(String(catId));
    const expected = resolveExpectedFromCategory(
      category.key,
      category.budget_group,
    );
    return expected && (tx.analysis_category || null) !== expected;
  }).length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        checkedWindow: {
          start: "2026-01-01",
          endExclusive: "2026-04-01",
          rows: rows.length,
        },
        strictCategoryRuleCoverage: {
          rowsWithDeterministicExpectedCategory: strictCheckedRows.length,
          mismatches: strictMismatches,
        },
        savingsSummary,
        allowanceSummary,
        textHintSummary,
        mismatchSamples,
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
