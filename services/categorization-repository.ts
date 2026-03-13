import { supabase } from "@/services/supabase";
import type {
    AutoCategorizationUpdate,
    CategorizationAuditEntry,
    CategoryRecord,
    CategoryRuleRecord,
    ManualCategoryUpdateOptions,
    TransactionCategorizationRecord,
} from "@/types/categorization";

export type CategorizationRepository = {
  getCategories: () => Promise<CategoryRecord[]>;
  getActiveRules: () => Promise<CategoryRuleRecord[]>;
  getPendingTransactionIds: (limit: number) => Promise<string[]>;
  getAllTransactionIds: (limit: number, offset?: number) => Promise<string[]>;
  getRecategorizableTransactionIds: (
    limit: number,
    offset?: number,
  ) => Promise<string[]>;
  getTransactionsByIds: (
    ids: string[],
  ) => Promise<TransactionCategorizationRecord[]>;
  updateAutoCategory: (update: AutoCategorizationUpdate) => Promise<void>;
  clearAutoCategories: (transactionIds: string[]) => Promise<void>;
  insertAudit: (entry: CategorizationAuditEntry) => Promise<void>;
  incrementRuleHit: (ruleId: string) => Promise<void>;
  setManualCategory: (
    transactionId: string,
    categoryId: string,
    model: string,
  ) => Promise<{
    previousCategoryId: string | null;
    counterparty: string | null;
  }>;
  upsertCounterpartyRule: (
    normalizedPattern: string,
    rawPattern: string,
    categoryId: string,
  ) => Promise<void>;
  clearAllTransactionData: () => Promise<void>;
};

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createSupabaseCategorizationRepository(): CategorizationRepository {
  return {
    async getCategories() {
      const { data, error } = await supabase
        .from("categories")
        .select("id,key,name,parent_id,budget_group,sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as CategoryRecord[];
    },

    async getActiveRules() {
      const { data, error } = await supabase
        .from("category_rules")
        .select(
          "id,category_id,pattern,pattern_normalized,pattern_type,confidence,hit_count,is_active,is_system",
        )
        .eq("is_active", true)
        .order("hit_count", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({
        ...row,
        confidence: asNumber(row.confidence, 0.9),
        hit_count: asNumber(row.hit_count, 0),
      }));
    },

    async getPendingTransactionIds(limit) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id")
        .is("category_id_user", null)
        .is("category_id_auto", null)
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data || []) as { id: string }[]).map((row) => row.id);
    },

    async getRecategorizableTransactionIds(limit, offset = 0) {
      const to = Math.max(offset + limit - 1, offset);
      const { data, error } = await supabase
        .from("transactions")
        .select("id")
        .is("category_id_user", null)
        .order("date", { ascending: false })
        .range(offset, to);
      if (error) throw error;
      return ((data || []) as { id: string }[]).map((row) => row.id);
    },

    async getAllTransactionIds(limit, offset = 0) {
      const to = Math.max(offset + limit - 1, offset);
      const { data, error } = await supabase
        .from("transactions")
        .select("id")
        .order("date", { ascending: false })
        .range(offset, to);
      if (error) throw error;
      return ((data || []) as { id: string }[]).map((row) => row.id);
    },

    async getTransactionsByIds(ids) {
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id,details,counterparty,amount,date,category_id_auto,category_id_user",
        )
        .in("id", ids);
      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        details: String(row.details || ""),
        counterparty: row.counterparty ? String(row.counterparty) : null,
        amount: asNumber(row.amount, 0),
        date: String(row.date || ""),
        category_id_auto: row.category_id_auto || null,
        category_id_user: row.category_id_user || null,
      }));
    },

    async updateAutoCategory(update) {
      const { error } = await supabase
        .from("transactions")
        .update({
          category_id_auto: update.categoryId,
          category_confidence: update.confidence,
          category_source: update.source,
          category_model: update.model,
          categorized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.transactionId);
      if (error) throw error;
    },

    async clearAutoCategories(transactionIds) {
      if (!transactionIds.length) return;
      const { error } = await supabase
        .from("transactions")
        .update({
          category_id_auto: null,
          category_confidence: null,
          category_source: null,
          category_model: null,
          categorized_at: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", transactionIds)
        .is("category_id_user", null);
      if (error) throw error;
    },

    async insertAudit(entry) {
      const { error } = await supabase.from("categorization_audit").insert({
        transaction_id: entry.transactionId,
        previous_category_id: entry.previousCategoryId,
        new_category_id: entry.newCategoryId,
        source: entry.source,
        model: entry.model || null,
        confidence: entry.confidence ?? null,
        reason: entry.reason || null,
      });
      if (error) throw error;
    },

    async incrementRuleHit(ruleId) {
      const { data, error } = await supabase
        .from("category_rules")
        .select("hit_count")
        .eq("id", ruleId)
        .single();
      if (error) throw error;
      const current = asNumber(data?.hit_count, 0);
      const { error: updError } = await supabase
        .from("category_rules")
        .update({
          hit_count: current + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ruleId);
      if (updError) throw updError;
    },

    async setManualCategory(transactionId, categoryId, model) {
      const { data, error } = await supabase
        .from("transactions")
        .select("category_id_user,category_id_auto,counterparty")
        .eq("id", transactionId)
        .single();
      if (error) throw error;

      const previousCategoryId = (data?.category_id_user ||
        data?.category_id_auto ||
        null) as string | null;
      const counterparty = (data?.counterparty || null) as string | null;

      const { error: updError } = await supabase
        .from("transactions")
        .update({
          category_id_user: categoryId,
          category_confidence: 1,
          category_source: "manual",
          category_model: model,
          categorized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);
      if (updError) throw updError;

      return { previousCategoryId, counterparty };
    },

    async upsertCounterpartyRule(normalizedPattern, rawPattern, categoryId) {
      const payload = {
        category_id: categoryId,
        pattern: rawPattern,
        pattern_normalized: normalizedPattern,
        pattern_type: "counterparty_contains",
        confidence: 0.96,
        hit_count: 1,
        is_active: true,
        is_system: false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("category_rules")
        .upsert(payload, { onConflict: "pattern_normalized,pattern_type" });
      if (error) throw error;
    },

    async clearAllTransactionData() {
      console.log("[clearAllTransactionData] Deleting all transaction data...");

      const { count, error: countError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true });

      if (countError) {
        console.error(
          "[clearAllTransactionData] Error counting transactions:",
          countError,
        );
        throw countError;
      }

      const transactionCount = count ?? 0;
      console.log(
        `[clearAllTransactionData] Found ${transactionCount} transactions to delete`,
      );

      if (transactionCount === 0) {
        console.log("[clearAllTransactionData] No transactions to delete");
        return;
      }

      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .not("id", "is", null);

      if (deleteError) {
        console.error(
          "[clearAllTransactionData] Error deleting transactions:",
          deleteError,
        );
        throw deleteError;
      }

      console.log("[clearAllTransactionData] Transactions deleted");
      console.log(
        "[clearAllTransactionData] Categorization audit entries removed via cascade delete",
      );
    },
  };
}

export async function getTransactionCategories() {
  const repo = createSupabaseCategorizationRepository();
  return repo.getCategories();
}

export async function setTransactionManualCategory(
  transactionId: string,
  categoryId: string,
  options: ManualCategoryUpdateOptions = {},
) {
  const repo = createSupabaseCategorizationRepository();
  const update = await repo.setManualCategory(
    transactionId,
    categoryId,
    "manual-in-app",
  );

  await repo.insertAudit({
    transactionId,
    previousCategoryId: update.previousCategoryId,
    newCategoryId: categoryId,
    source: "manual",
    model: "manual-in-app",
    confidence: 1,
    reason: options.reason || "manual correction",
  });

  if (options.learnFromCounterparty && update.counterparty) {
    const normalizedPattern = normalizePattern(update.counterparty);
    if (normalizedPattern) {
      await repo.upsertCounterpartyRule(
        normalizedPattern,
        update.counterparty,
        categoryId,
      );
    }
  }
}

export function normalizePattern(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ── Transaction detail + counterparty helpers ──────────────────────────────

export type TransactionDetail = {
  id: string;
  date: string;
  details: string;
  counterparty: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  metadata: Record<string, unknown>;
  category_id_auto: string | null;
  category_id_user: string | null;
  category_confidence: number | null;
  category_source: string | null;
  category_model: string | null;
  categorized_at: string | null;
  created_at: string | null;
  is_reviewed: boolean;
  budget_excluded: boolean;
};

export type CounterpartyTxSummary = {
  id: string;
  date: string;
  details: string;
  counterparty: string | null;
  amount: number;
  category_id_auto: string | null;
  category_id_user: string | null;
};

export async function getTransactionDetail(
  id: string,
): Promise<TransactionDetail | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,date,details,counterparty,amount,currency,type,metadata,category_id_auto,category_id_user,category_confidence,category_source,category_model,categorized_at,created_at,is_reviewed,budget_excluded",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) return null;
  const d = data as any;
  return {
    id: String(d.id),
    date: String(d.date || ""),
    details: String(d.details || ""),
    counterparty: d.counterparty ? String(d.counterparty) : null,
    amount: asNumber(d.amount, 0),
    currency: d.currency ? String(d.currency) : null,
    type: d.type ? String(d.type) : null,
    metadata: (d.metadata || {}) as Record<string, unknown>,
    category_id_auto: d.category_id_auto || null,
    category_id_user: d.category_id_user || null,
    category_confidence:
      d.category_confidence == null ? null : Number(d.category_confidence),
    category_source: d.category_source || null,
    category_model: d.category_model || null,
    categorized_at: d.categorized_at || null,
    created_at: d.created_at || null,
    is_reviewed: Boolean(d.is_reviewed),
    budget_excluded: Boolean(d.budget_excluded),
  };
}

export async function getCounterpartyTransactions(
  counterparty: string,
  excludeId: string,
  limit = 5,
): Promise<CounterpartyTxSummary[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,date,details,counterparty,amount,category_id_auto,category_id_user",
    )
    .eq("counterparty", counterparty)
    .neq("id", excludeId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    date: String(row.date || ""),
    details: String(row.details || ""),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    amount: asNumber(row.amount, 0),
    category_id_auto: row.category_id_auto || null,
    category_id_user: row.category_id_user || null,
  }));
}

export async function countCounterpartyTransactions(
  counterparty: string,
  scope: "all" | "uncategorized",
): Promise<number> {
  const base = supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("counterparty", counterparty);
  const { count, error } =
    scope === "uncategorized"
      ? await base.is("category_id_user", null)
      : await base;
  if (error) throw error;
  return count ?? 0;
}

export async function bulkUpdateCategoryByCounterparty(
  counterparty: string,
  categoryId: string,
  scope: "all" | "uncategorized",
): Promise<number> {
  const countBase = supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("counterparty", counterparty);
  const { count, error: countError } =
    scope === "uncategorized"
      ? await countBase.is("category_id_user", null)
      : await countBase;
  if (countError) throw countError;
  if (!count) return 0;

  const updateBase = supabase
    .from("transactions")
    .update({
      category_id_user: categoryId,
      category_source: "manual",
      category_model: "manual-bulk",
      category_confidence: 1,
      categorized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("counterparty", counterparty);
  const { error: updateError } =
    scope === "uncategorized"
      ? await updateBase.is("category_id_user", null)
      : await updateBase;
  if (updateError) throw updateError;

  return count;
}

export async function setTransactionReviewed(
  id: string,
  reviewed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .update({ is_reviewed: reviewed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setTransactionBudgetExcluded(
  id: string,
  excluded: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .update({ budget_excluded: excluded, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
