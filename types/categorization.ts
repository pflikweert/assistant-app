export type CategoryRecord = {
  id: string;
  key: string;
  name: string;
  parent_id: string | null;
  budget_group: string | null;
  sort_order: number | null;
};

export type EditableBudgetGroup = "fixed" | "variable" | "subscriptions";

export type EffectiveBudgetGroup =
  | EditableBudgetGroup
  | "savings"
  | null;

export type CategoryBudgetGroupOverrideRecord = {
  categoryId: string;
  budgetGroup: EditableBudgetGroup;
  createdAt: string | null;
  updatedAt: string | null;
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
  scope?: string;
  user_id?: string | null;
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

export type SubscriptionBillingCycle = "monthly" | "quarterly" | "yearly";

export type SubscriptionProviderHint =
  | "paypal"
  | "google_play"
  | "apple"
  | "klarna"
  | "other";

export type SubscriptionProfile = {
  id: string;
  planKey: string;
  name: string;
  normalizedName: string;
  billingCycle: SubscriptionBillingCycle;
  expectedAmount: number | null;
  amountTolerance: number;
  expectedDayOfMonth: number | null;
  providerHint: SubscriptionProviderHint | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubscriptionProfileRuleType =
  | "counterparty_contains"
  | "details_contains";

export type SubscriptionProfileRule = {
  id: string;
  subscriptionProfileId: string;
  pattern: string;
  patternNormalized: string;
  patternType: SubscriptionProfileRuleType;
  weight: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubscriptionMatchSource =
  | "manual"
  | "rule"
  | "heuristic"
  | "ignored";

export type TransactionSubscriptionMatch = {
  transactionId: string;
  subscriptionProfileId: string | null;
  matchSource: SubscriptionMatchSource;
  confidence: number | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubscriptionSuggestion = {
  subscriptionProfileId: string;
  subscriptionName: string;
  confidence: number;
  confidenceLabel: "hoog" | "middel";
  reason: string;
};

export type SubscriptionQueueItem = {
  transactionId: string;
  date: string;
  counterparty: string | null;
  details: string;
  amount: number;
  providerDetected: SubscriptionProviderHint | null;
  suggestions: SubscriptionSuggestion[];
};

export type SubscriptionValidationCandidate = {
  transactionId: string;
  date: string;
  counterparty: string | null;
  details: string;
  amount: number;
  providerDetected: SubscriptionProviderHint | null;
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

export type ForecastIncomeBucket =
  | "salary"
  | "childBudget"
  | "structuralOther"
  | "variable";

export type ForecastIncomeSource = {
  sourceKey: string;
  sourceLabel: string;
  expectedIncome: number;
  incomeBucket: ForecastIncomeBucket | null;
  incomeFrequency: RecurringType;
  incomeDayOfMonth: number | null;
  lastDetectedAt: string;
  referenceTransactionId?: string | null;
  referenceCategoryId?: string | null;
  referenceCategoryPath?: string | null;
  referenceLabel?: string | null;
  referenceSourceType?: "transaction" | "derived" | null;
};

export type ForecastRefreshReason =
  | "insights_open"
  | "historical_month_open"
  | "future_month_open"
  | "manual_refresh"
  | "budget_save"
  | "budget_toggle"
  | "manual_category"
  | "categorization_batch"
  | "subscription_profile"
  | "forecast_backfill";

export type ForecastRefreshStatus = {
  isDirty: boolean;
  dirtyAt: string | null;
  lastComputedAt: string | null;
  lastReason: ForecastRefreshReason | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type MonthlyCashflowForecast = {
  monthStart: string;
  startingBalance: number | null;
  forecastReferenceDate: string | null;
  currentBalanceAnchor: number | null;
  currentBalanceAnchorDate: string | null;
  bookedIncomeTotal: number;
  bookedExpenseTotal: number;
  bookedSavingsOutflowTotal: number;
  remainingExpectedIncomeTotal: number;
  remainingExpectedExpenseTotal: number;
  remainingExpectedSavingsOutflowTotal: number;
  expectedIncomeTotal: number;
  expectedIncomeStructuralTotal: number;
  expectedIncomeVariableTotal: number;
  expectedExpenseTotal: number;
  expectedSavingsOutflowTotal: number;
  expectedCashOutTotal: number;
  expectedFixedCosts: number;
  expectedSubscriptions: number;
  expectedVariableCosts: number;
  upcomingCommittedIncomeTotal: number;
  upcomingCommittedExpenseTotal: number;
  upcomingCommittedSavingsOutflowTotal: number;
  lowestExpectedBalance: number | null;
  lowestExpectedBalanceDate: string | null;
  nextExpectedEventDate: string | null;
  nextExpectedEventLabel: string | null;
  avgGroceries: number;
  avgFuel: number;
  avgSmoking: number;
  avgOtherVariable: number;
  expectedEndOfMonthBalance: number | null;
  riskFlag: "none" | "deficit_warning";
  cashRiskFlag: "none" | "cash_gap_warning";
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

export type BudgetPlanMode = "active_savings" | "balanced" | "custom";

export type BudgetCategoryKey =
  | "fixed_costs"
  | "subscriptions"
  | "variable_costs"
  | "groceries"
  | "fuel"
  | "smoking"
  | "other"
  | "savings_target";

export type BudgetWarningSeverity = "info" | "warning" | "critical";

export type BudgetSavingsTargetSource =
  | "automatic_active"
  | "automatic_balanced"
  | "manual_custom";

export type BudgetOverrideSource =
  | "trend"
  | "settings"
  | "category_override"
  | "monthly_override"
  | "trend_lock";

export type BudgetIncomeInclusionSettings = {
  salary: boolean;
  childBudget: boolean;
  structuralOther: boolean;
  variable: boolean;
};

export type BudgetForecastExpenseSource = "trend" | "budget_settings";

export type BudgetPlanSettings = {
  planKey: string;
  mode: BudgetPlanMode;
  adjustmentFactor: number;
  includeIncome: BudgetIncomeInclusionSettings;
  forecastExpenseSource: BudgetForecastExpenseSource;
  applySavingsTargetToVariableBudget: boolean;
  savingsTargetMonthly: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BudgetCategoryOverride = {
  planKey: string;
  categoryKey: BudgetCategoryKey;
  monthlyTargetOverride: number | null;
  factorOverride: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MonthlyBudgetValue = {
  planKey: string;
  monthStart: string;
  categoryKey: BudgetCategoryKey;
  monthlyBudget: number;
  source: "manual" | "system";
  lockTrend: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BudgetIncomeBreakdown = {
  salary: number;
  childBudget: number;
  structuralOther: number;
  variable: number;
  windfalls: number;
  costRefunds: number;
  total: number;
};

export type BudgetVariableBreakdown = {
  groceries: number;
  fuel: number;
  smoking: number;
  other: number;
  total: number;
};

export type BudgetExpenseBreakdown = {
  fixedCosts: number;
  subscriptions: number;
  variableCosts: number;
  savingsTransfer: number;
  total: number;
  variable: BudgetVariableBreakdown;
};

export type BudgetTrendSnapshot = {
  windowDays: number;
  observedDays: number;
  monthlyScale: number;
  income: BudgetIncomeBreakdown;
  expenses: BudgetExpenseBreakdown;
  net: number;
};

export type BudgetRecommendationRow = {
  categoryKey: BudgetCategoryKey;
  label: string;
  baselineMonthly: number;
  appliedFactor: number;
  monthlyBudget: number;
  weeklyBudget: number;
  monthlyActual: number;
  monthProgress: number;
  utilization: number;
  overrideSource: BudgetOverrideSource;
};

export type BudgetWarning = {
  categoryKey: BudgetCategoryKey;
  severity: BudgetWarningSeverity;
  utilization: number;
  message: string;
};

export type BudgetCoachReportSections = {
  summary: string;
  strengths: string[];
  risks: string[];
  actions: string[];
};

export type BudgetCoachReport = {
  generatedAt: string;
  sections: BudgetCoachReportSections;
};

export type BudgetExpenseDetailItem = {
  label: string;
  amount: number;
  transactionCount: number;
  lastTransactionDate: string | null;
};

export type BudgetOutsideExpenseItem = BudgetExpenseDetailItem & {
  categoryLabel: string;
  groupKey: string;
  transactionIds: string[];
};

export type BudgetOutsideExpenseSummary = {
  total: number;
  fixedCosts: number;
  subscriptions: number;
  variableCosts: number;
  savingsTransfer: number;
  items: BudgetOutsideExpenseItem[];
};

export type BudgetFlowSummary = {
  expectedIncomeMonthly: number;
  actualIncomeMonthToDate: number;
  fixedCostsBudget: number;
  subscriptionsBudget: number;
  subtotalAfterFixed: number;
  subtotalAfterSubscriptions: number;
  variableBudget: number;
  variableSubcategoriesBudgetTotal: number;
  appliedSavingsTarget: number;
  automaticSavingsTargetPreview: {
    activeSavings: number;
    balanced: number;
  };
  savingsTargetSource: BudgetSavingsTargetSource;
  usedOpenAISavingsTarget: boolean;
};

export type BudgetWeekPlanRow = {
  weekNumber: number;
  label: string;
  startDate: string;
  endDateExclusive: string;
  daysInCurrentMonth: number;
  daysInPreviousMonth: number;
  daysInNextMonth: number;
  crossesMonthBoundary: boolean;
  budget: number;
  actual: number;
  remaining: number;
  utilization: number;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  wasRebalanced: boolean;
  overrunAmount: number;
};

export type BudgetWeekSubcategorySpend = {
  key: string;
  label: string;
  amount: number;
};

export type BudgetWeekCategorySpend = {
  key: string;
  label: string;
  amount: number;
  subcategories: BudgetWeekSubcategorySpend[];
};

export type BudgetWeekSpendBreakdown = {
  weekNumber: number;
  startDate: string;
  endDateExclusive: string;
  categories: BudgetWeekCategorySpend[];
};

export type BudgetWeekCategoryBudget = {
  key: string;
  label: string;
  amount: number;
};

export type BudgetWeekBudgetBreakdown = {
  weekNumber: number;
  startDate: string;
  endDateExclusive: string;
  categories: BudgetWeekCategoryBudget[];
};

export type BudgetSavingsProgress = {
  recommendedSavings: number;
  earnedActual: number;
  earnedOnTrack: number;
  progressActual: number;
  progressOnTrack: number;
};

export type BudgetPlanComputation = {
  planKey: string;
  referenceDate: string;
  monthStart: string;
  monthProgress: number;
  completedMonthBaselineThrough: string | null;
  settings: BudgetPlanSettings;
  trend: BudgetTrendSnapshot;
  monthToDateIncome: BudgetIncomeBreakdown;
  monthToDateExpenses: BudgetExpenseBreakdown;
  recommendations: BudgetRecommendationRow[];
  warnings: BudgetWarning[];
  savingsPotential: number;
  recommendedSavings: number;
  automaticSavingsTargetPreview: {
    activeSavings: number;
    balanced: number;
  };
  savingsTargetSource: BudgetSavingsTargetSource;
  usedOpenAISavingsTarget: boolean;
  monthlyBudgetTotal: number;
  weeklyBudgetTotal: number;
  flowSummary: BudgetFlowSummary;
  weeklyVariablePlan: BudgetWeekPlanRow[];
  weeklyBudgetBreakdown: BudgetWeekBudgetBreakdown[];
  weeklySpendBreakdown: BudgetWeekSpendBreakdown[];
  outsideBudgetExpenses: BudgetOutsideExpenseSummary;
  expenseDetails: {
    fixedCosts: BudgetExpenseDetailItem[];
    subscriptions: BudgetExpenseDetailItem[];
  };
  savingsProgress: BudgetSavingsProgress;
  coachReport: BudgetCoachReport;
};
