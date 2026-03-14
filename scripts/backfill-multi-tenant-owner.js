require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(url, key);
const BATCH_SIZE = 500;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function chunk(array, size) {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

async function ensureDefaultBankAccount({
  userId,
  accountName,
  accountType,
  provider,
  currency,
}) {
  const { data: existing, error: existingError } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", accountName)
    .eq("provider", provider)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return String(existing.id);

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      user_id: userId,
      name: accountName,
      account_type: accountType,
      provider,
      currency,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return String(data.id);
}

async function updateWhereNull(table, payload, selectColumn = "id") {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .is("user_id", null)
    .select(selectColumn);

  if (error) throw error;
  return (data || []).length;
}

async function updateTransactionsForUser(userId, bankAccountId) {
  let updatedUserAndAccount = 0;
  let updatedAccountOnly = 0;
  let updatedUserOnly = 0;

  const bothRes = await supabase
    .from("transactions")
    .update({
      user_id: userId,
      bank_account_id: bankAccountId,
    })
    .is("user_id", null)
    .is("bank_account_id", null)
    .select("id");
  if (bothRes.error) throw bothRes.error;
  updatedUserAndAccount = (bothRes.data || []).length;

  const accountOnlyRes = await supabase
    .from("transactions")
    .update({
      bank_account_id: bankAccountId,
    })
    .eq("user_id", userId)
    .is("bank_account_id", null)
    .select("id");
  if (accountOnlyRes.error) throw accountOnlyRes.error;
  updatedAccountOnly = (accountOnlyRes.data || []).length;

  const userOnlyRes = await supabase
    .from("transactions")
    .update({
      user_id: userId,
    })
    .is("user_id", null)
    .eq("bank_account_id", bankAccountId)
    .select("id");
  if (userOnlyRes.error) throw userOnlyRes.error;
  updatedUserOnly = (userOnlyRes.data || []).length;

  const { data: allTransactions, error: allTransactionsError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .limit(100000);

  if (allTransactionsError) throw allTransactionsError;

  return {
    updatedUserAndAccount,
    updatedAccountOnly,
    updatedUserOnly,
    transactionIds: (allTransactions || []).map((row) => String(row.id)),
  };
}

async function updateByIdBatches(table, idColumn, ids, payload) {
  let updated = 0;
  for (const batch of chunk(ids, BATCH_SIZE)) {
    if (!batch.length) continue;
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .in(idColumn, batch)
      .select(idColumn);
    if (error) throw error;
    updated += (data || []).length;
  }
  return updated;
}

async function backfillOwnership(params) {
  const defaultAccountId = await ensureDefaultBankAccount(params);
  const transactionStats = await updateTransactionsForUser(
    params.userId,
    defaultAccountId,
  );

  const auditUpdated = await updateByIdBatches(
    "categorization_audit",
    "transaction_id",
    transactionStats.transactionIds,
    { user_id: params.userId },
  );

  const nonSystemRules = await supabase
    .from("category_rules")
    .select("id")
    .eq("is_system", false)
    .is("user_id", null)
    .limit(100000);
  if (nonSystemRules.error) throw nonSystemRules.error;

  const categoryRuleIds = (nonSystemRules.data || []).map((row) =>
    String(row.id),
  );
  const categoryRulesUpdated = await updateByIdBatches(
    "category_rules",
    "id",
    categoryRuleIds,
    {
      user_id: params.userId,
      scope: "user",
    },
  );

  const budgetPlanSettingsUpdated = await updateWhereNull(
    "budget_plan_settings",
    { user_id: params.userId },
  );
  const budgetCategoryOverridesUpdated = await updateWhereNull(
    "budget_category_overrides",
    { user_id: params.userId },
  );
  const monthlyBudgetValuesUpdated = await updateWhereNull(
    "monthly_budget_values",
    { user_id: params.userId },
  );
  const forecastIncomeSourcesUpdated = await updateWhereNull(
    "forecast_income_sources",
    { user_id: params.userId },
  );
  const monthlyCashflowForecastsUpdated = await updateWhereNull(
    "monthly_cashflow_forecasts",
    { user_id: params.userId },
  );
  const subscriptionProfilesUpdated = await updateWhereNull(
    "subscription_profiles",
    { user_id: params.userId },
  );

  const subscriptionProfiles = await supabase
    .from("subscription_profiles")
    .select("id")
    .eq("user_id", params.userId)
    .limit(100000);
  if (subscriptionProfiles.error) throw subscriptionProfiles.error;

  const subscriptionProfileIds = (subscriptionProfiles.data || []).map((row) =>
    String(row.id),
  );
  const subscriptionProfileRulesUpdated = await updateByIdBatches(
    "subscription_profile_rules",
    "subscription_profile_id",
    subscriptionProfileIds,
    { user_id: params.userId },
  );
  const transactionSubscriptionMatchesUpdated = await updateByIdBatches(
    "transaction_subscription_matches",
    "transaction_id",
    transactionStats.transactionIds,
    { user_id: params.userId },
  );

  return {
    defaultAccountId,
    transactions: {
      updatedUserAndAccount: transactionStats.updatedUserAndAccount,
      updatedAccountOnly: transactionStats.updatedAccountOnly,
      updatedUserOnly: transactionStats.updatedUserOnly,
      totalUserTransactions: transactionStats.transactionIds.length,
    },
    categorizationAuditUpdated: auditUpdated,
    categoryRulesUpdated,
    budgetPlanSettingsUpdated,
    budgetCategoryOverridesUpdated,
    monthlyBudgetValuesUpdated,
    forecastIncomeSourcesUpdated,
    monthlyCashflowForecastsUpdated,
    subscriptionProfilesUpdated,
    subscriptionProfileRulesUpdated,
    transactionSubscriptionMatchesUpdated,
  };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const userId = String(args["user-id"] || "").trim();
  if (!userId) {
    throw new Error(
      "Missing required --user-id <auth.users uuid> argument.",
    );
  }

  const result = await backfillOwnership({
    userId,
    accountName: String(
      args["account-name"] || "Legacy imported transactions",
    ).trim(),
    accountType: String(args["account-type"] || "checking").trim(),
    provider: String(args.provider || "legacy_backfill").trim(),
    currency: String(args.currency || "EUR").trim().toUpperCase(),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId,
        result,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
