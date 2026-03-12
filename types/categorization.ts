export type CategoryRecord = {
  id: string;
  key: string;
  name: string;
  parent_id: string | null;
  budget_group: string | null;
  sort_order: number | null;
};

export type CategoryRuleRecord = {
  id: string;
  category_id: string;
  pattern: string;
  pattern_normalized: string;
  pattern_type: string;
  confidence: number;
  hit_count: number;
  is_active: boolean;
  is_system?: boolean;
};

export type TransactionCategorizationRecord = {
  id: string;
  details: string;
  counterparty: string | null;
  amount: number;
  date: string;
  category_id_auto: string | null;
  category_id_user: string | null;
};

export type CategorizationSource = "rule" | "openai" | "fallback" | "manual";

export type AutoCategorizationUpdate = {
  transactionId: string;
  categoryId: string;
  confidence: number;
  source: Exclude<CategorizationSource, "manual">;
  model: string;
};

export type CategorizationAuditEntry = {
  transactionId: string;
  previousCategoryId: string | null;
  newCategoryId: string;
  source: CategorizationSource;
  model?: string;
  confidence?: number;
  reason?: string;
};

export type ManualCategoryUpdateOptions = {
  reason?: string;
  learnFromCounterparty?: boolean;
};
