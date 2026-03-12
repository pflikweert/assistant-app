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
  analysis_main_group?: AnalysisMainGroup | null;
  analysis_category?: AnalysisCategory | null;
  recurring?: boolean;
  recurring_type?: RecurringType | null;
  spending_pattern?: SpendingPattern | null;
};

export type AnalysisMainGroup = "income" | "expense";

export type ExpenseAnalysisCategory =
  | "fixed_costs"
  | "subscriptions"
  | "variable_costs"
  | "savings_transfer";

export type IncomeAnalysisCategory = "income_structural" | "income_variable";

export type AnalysisCategory = ExpenseAnalysisCategory | IncomeAnalysisCategory;

export type RecurringType = "monthly" | "quarterly" | "yearly" | "irregular";

export type SpendingPattern = "frequent_small_expense";

export type TransactionAnalysisUpdate = {
  transactionId: string;
  analysisMainGroup: AnalysisMainGroup | null;
  analysisCategory: AnalysisCategory | null;
  recurring: boolean;
  recurringType: RecurringType | null;
  spendingPattern: SpendingPattern | null;
};

export type ForecastIncomeSource = {
  sourceKey: string;
  sourceLabel: string;
  expectedIncome: number;
  incomeFrequency: RecurringType;
  incomeDayOfMonth: number | null;
  lastDetectedAt: string;
};

export type MonthlyCashflowForecast = {
  monthStart: string;
  startingBalance: number | null;
  expectedIncomeTotal: number;
  expectedExpenseTotal: number;
  expectedFixedCosts: number;
  expectedSubscriptions: number;
  expectedVariableCosts: number;
  avgGroceries: number;
  avgFuel: number;
  avgSmoking: number;
  avgOtherVariable: number;
  expectedEndOfMonthBalance: number | null;
  riskFlag: "none" | "deficit_warning";
  topCostBuckets: string[];
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
