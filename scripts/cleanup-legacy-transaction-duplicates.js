require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or a usable Supabase key.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");

function normalizeTransactionDetails(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
}

function toIso(value) {
  if (!value) return "";
  return String(value);
}

function byNewest(left, right) {
  return (
    toIso(right.updated_at || right.created_at).localeCompare(
      toIso(left.updated_at || left.created_at),
    ) ||
    toIso(right.created_at).localeCompare(toIso(left.created_at))
  );
}

function chooseCanonicalRow(rows) {
  return [...rows].sort((left, right) => {
    const leftCanonical =
      normalizeTransactionDetails(left.details) === String(left.details || "");
    const rightCanonical =
      normalizeTransactionDetails(right.details) === String(right.details || "");
    if (leftCanonical !== rightCanonical) {
      return leftCanonical ? -1 : 1;
    }
    return byNewest(left, right);
  })[0];
}

function chooseLatestNonEmpty(rows, field) {
  return [...rows].sort(byNewest).find((row) => {
    const value = row[field];
    return value !== null && value !== undefined && value !== "";
  })?.[field];
}

function chooseAnyTrue(rows, field) {
  return rows.some((row) => Boolean(row[field]));
}

function mergeMetadata(rows) {
  return rows.reduce((acc, row) => {
    if (row.metadata && typeof row.metadata === "object") {
      Object.assign(acc, row.metadata);
    }
    return acc;
  }, {});
}

function buildDuplicateKey(row) {
  return [
    row.user_id || "",
    row.bank_account_id || "",
    row.date || "",
    row.amount || "",
    normalizeTransactionDetails(row.details),
  ].join("|");
}

function scoreMatch(match) {
  const sourceScore = {
    manual: 400,
    rule: 300,
    heuristic: 200,
    ignored: 100,
  };
  return (
    (match.subscription_profile_id ? 1000 : 0) +
    (sourceScore[match.match_source] || 0) +
    Number(match.confidence || 0)
  );
}

async function fetchAll(table, select) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const transactions = await fetchAll("transactions", "*");
  const matches = await fetchAll(
    "transaction_subscription_matches",
    "transaction_id,subscription_profile_id,match_source,confidence,notes,created_at,updated_at",
  );
  const audits = await fetchAll("categorization_audit", "id,transaction_id");

  const groups = new Map();
  for (const row of transactions) {
    const key = buildDuplicateKey(row);
    const bucket = groups.get(key) || [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const duplicateGroups = [...groups.values()].filter((bucket) => bucket.length > 1);
  const matchByTransactionId = new Map(
    matches.map((row) => [String(row.transaction_id), row]),
  );

  const cleanupPlan = duplicateGroups.map((rows) => {
    const keep = chooseCanonicalRow(rows);
    const remove = rows.filter((row) => row.id !== keep.id);
    const mergedMetadata = mergeMetadata(rows);
    const merged = {
      details: normalizeTransactionDetails(keep.details),
      counterparty: chooseLatestNonEmpty(rows, "counterparty") || null,
      currency: chooseLatestNonEmpty(rows, "currency") || null,
      type: chooseLatestNonEmpty(rows, "type") || null,
      category_id_user: chooseLatestNonEmpty(rows, "category_id_user") || null,
      category_id_auto: chooseLatestNonEmpty(rows, "category_id_auto") || null,
      category_confidence: chooseLatestNonEmpty(rows, "category_confidence") ?? null,
      category_source: chooseLatestNonEmpty(rows, "category_source") || null,
      category_model: chooseLatestNonEmpty(rows, "category_model") || null,
      categorized_at: chooseLatestNonEmpty(rows, "categorized_at") || null,
      analysis_main_group: chooseLatestNonEmpty(rows, "analysis_main_group") || null,
      analysis_category: chooseLatestNonEmpty(rows, "analysis_category") || null,
      analysis_updated_at: chooseLatestNonEmpty(rows, "analysis_updated_at") || null,
      recurring: chooseAnyTrue(rows, "recurring"),
      recurring_type: chooseLatestNonEmpty(rows, "recurring_type") || null,
      spending_pattern: chooseLatestNonEmpty(rows, "spending_pattern") || null,
      budget_excluded: chooseAnyTrue(rows, "budget_excluded"),
      is_reviewed: chooseAnyTrue(rows, "is_reviewed"),
      metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    };

    const bucketMatches = rows
      .map((row) => matchByTransactionId.get(String(row.id)))
      .filter(Boolean)
      .sort((left, right) => scoreMatch(right) - scoreMatch(left));

    return {
      key: buildDuplicateKey(keep),
      keep,
      remove,
      merged,
      chosenMatch: bucketMatches[0] || null,
      auditIds: audits
        .filter((audit) => rows.some((row) => row.id === audit.transaction_id))
        .map((audit) => audit.id),
    };
  });

  const duplicateIdsToRemove = cleanupPlan.flatMap((item) =>
    item.remove.map((row) => row.id),
  );

  const normalizedOnlyRows = transactions
    .filter((row) => !duplicateIdsToRemove.includes(row.id))
    .filter(
      (row) => normalizeTransactionDetails(row.details) !== String(row.details || ""),
    )
    .map((row) => ({
      id: row.id,
      from: row.details,
      to: normalizeTransactionDetails(row.details),
    }));

  const backup = {
    generatedAt: new Date().toISOString(),
    applyMode: APPLY,
    duplicateGroupCount: cleanupPlan.length,
    duplicateRowCount: duplicateIdsToRemove.length,
    normalizedOnlyCount: normalizedOnlyRows.length,
    duplicateGroups: cleanupPlan.map((item) => ({
      keep: item.keep,
      remove: item.remove,
      merged: item.merged,
      chosenMatch: item.chosenMatch,
      auditIds: item.auditIds,
    })),
    normalizedOnlyRows,
  };

  const backupDir = path.join(process.cwd(), "tmp", "transaction-duplicate-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `transactions-duplicate-cleanup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        backupPath,
        duplicateGroups: cleanupPlan.length,
        duplicateRowsToRemove: duplicateIdsToRemove.length,
        normalizedOnlyRows: normalizedOnlyRows.length,
      },
      null,
      2,
    ),
  );

  if (!APPLY) return;

  for (const item of cleanupPlan) {
    const keepId = item.keep.id;
    const removeIds = item.remove.map((row) => row.id);

    const { error: updateKeepError } = await supabase
      .from("transactions")
      .update(item.merged)
      .eq("id", keepId);
    if (updateKeepError) throw updateKeepError;

    if (item.chosenMatch) {
      const { error: upsertMatchError } = await supabase
        .from("transaction_subscription_matches")
        .upsert(
          {
            transaction_id: keepId,
            subscription_profile_id: item.chosenMatch.subscription_profile_id,
            match_source: item.chosenMatch.match_source,
            confidence: item.chosenMatch.confidence,
            notes: item.chosenMatch.notes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "transaction_id" },
        );
      if (upsertMatchError) throw upsertMatchError;
    }

    if (removeIds.length) {
      const { error: moveAuditError } = await supabase
        .from("categorization_audit")
        .update({ transaction_id: keepId })
        .in("transaction_id", removeIds);
      if (moveAuditError) throw moveAuditError;

      const { error: deleteMatchError } = await supabase
        .from("transaction_subscription_matches")
        .delete()
        .in("transaction_id", removeIds);
      if (deleteMatchError) throw deleteMatchError;

      const { error: deleteTxError } = await supabase
        .from("transactions")
        .delete()
        .in("id", removeIds);
      if (deleteTxError) throw deleteTxError;
    }
  }

  for (const row of normalizedOnlyRows) {
    const { error } = await supabase
      .from("transactions")
      .update({ details: row.to, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw error;
  }

  console.log(
    JSON.stringify(
      {
        status: "completed",
        deletedDuplicateRows: duplicateIdsToRemove.length,
        normalizedOnlyRows: normalizedOnlyRows.length,
        backupPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify(error, null, 2));
  process.exit(1);
});
