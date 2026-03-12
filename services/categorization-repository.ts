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
      console.log("[clearAllTransactionData] Clearing transaction categorization data...");
      // Clear all transaction categorization data (but keep transactions themselves)
      const { error } = await supabase
        .from("transactions")
        .update({
          category_id_auto: null,
          category_id_user: null,
          category_confidence: null,
          category_source: null,
          category_model: null,
          categorized_at: null,
          updated_at: new Date().toISOString(),
        })
        .neq("id", ""); // This updates all rows

      if (error) {
        console.error("[clearAllTransactionData] Error clearing transactions:", error);
        throw error;
      }
      console.log("[clearAllTransactionData] Transactions cleared");

      // Also clear the categorization audit log
      console.log("[clearAllTransactionData] Clearing audit log...");
      const { error: auditError } = await supabase
        .from("categorization_audit")
        .delete()
        .neq("id", ""); // This deletes all rows

      if (auditError) {
        console.error("[clearAllTransactionData] Error clearing audit log:", auditError);
        throw auditError;
      }
      console.log("[clearAllTransactionData] Audit log cleared");
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
