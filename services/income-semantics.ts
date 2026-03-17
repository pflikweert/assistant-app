type CategoryMeta = {
  key: string;
  budget_group?: string | null;
};

type CategorizedRow = {
  amount: number;
  details: string;
  counterparty: string | null;
  category_id_auto?: string | null;
  category_id_user?: string | null;
  analysis_category?:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
};

export type IncomeBudgetBucket =
  | "salary"
  | "childBudget"
  | "structuralOther"
  | "variable"
  | "windfall"
  | "costRefund";

export type IncomeSemanticsKind =
  | "none"
  | "salary"
  | "child_budget"
  | "structural_government"
  | "structural_other"
  | "variable_income"
  | "tax_refund"
  | "expense_refund";

export type IncomeSemantics = {
  kind: IncomeSemanticsKind;
  budgetBucket: IncomeBudgetBucket | null;
  analysisCategory: "income_structural" | "income_variable" | null;
  forecastEligible: boolean;
  countsAsIncome: boolean;
  expenseOffsetBucket:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | null;
  shortLabel: string | null;
  groupLabel: string | null;
};

const SALARY_HINTS = ["salaris", "loon", "salary"];
const CHILD_BUDGET_HINTS = [
  "kindgebonden budget",
  "voorschot kit kgb",
  "voorschot kit/kgb",
  "child budget",
];
const GOVERNMENT_BENEFIT_HINTS = [
  "toeslag",
  "huurtoeslag",
  "zorgtoeslag",
  "kinderopvangtoeslag",
  "uitkering",
];
const TAX_REFUND_HINTS = [
  "teruggave",
  "teruggaaf",
  "voorlopige aanslag",
  "inkomstenbelasting",
  "belastingteruggave",
  "belasting teruggave",
  "refund",
];
const HEALTH_REFUND_HINTS = [
  "bijdrage zvw",
  "zorgverzekering",
  "zorgverzekeringswet",
];
const ROAD_TAX_HINTS = ["wegenbelasting", "motorrijtuig", "mrb"];

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function normalizeCategoryKey(categoryKey: string | null | undefined) {
  return String(categoryKey || "").toLowerCase().trim();
}

function normalizeBudgetGroup(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
}

function isHealthInsuranceCategory(categoryKey: string) {
  return (
    categoryKey.startsWith("care_health_insurance") ||
    categoryKey.startsWith("insurance_health") ||
    categoryKey.startsWith("health_insurance")
  );
}

function isRoadTaxCategory(categoryKey: string) {
  return categoryKey.startsWith("auto_transport_road_tax");
}

function resolveIncomeSemanticsFromInput(input: {
  amount: number;
  details: string;
  counterparty: string | null;
  categoryKey?: string | null;
  budgetGroup?: string | null;
  analysisCategory?:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
}): IncomeSemantics {
  if (Number(input.amount || 0) <= 0) {
    return {
      kind: "none",
      budgetBucket: null,
      analysisCategory: null,
      forecastEligible: false,
      countsAsIncome: false,
      expenseOffsetBucket: null,
      shortLabel: null,
      groupLabel: null,
    };
  }

  const categoryKey = normalizeCategoryKey(input.categoryKey);
  const budgetGroup = normalizeBudgetGroup(input.budgetGroup);
  const haystack = normalizeText(`${input.counterparty || ""} ${input.details || ""}`);
  const isBelastingdienst = normalizeText(input.counterparty || "").includes(
    "belastingdienst",
  );
  const hasSalaryHint = includesAny(haystack, SALARY_HINTS);
  const hasChildBudgetHint =
    includesAny(haystack, CHILD_BUDGET_HINTS) || haystack.includes(" kgb ");
  const hasGovernmentBenefitHint = includesAny(
    haystack,
    GOVERNMENT_BENEFIT_HINTS,
  );
  const hasTaxRefundHint = includesAny(haystack, TAX_REFUND_HINTS);
  const hasHealthRefundHint = includesAny(haystack, HEALTH_REFUND_HINTS);
  const hasRoadTaxHint = includesAny(haystack, ROAD_TAX_HINTS);

  if (categoryKey.includes("income_salary") || hasSalaryHint) {
    return {
      kind: "salary",
      budgetBucket: "salary",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
      expenseOffsetBucket: null,
      shortLabel: "Salaris",
      groupLabel: "Salaris",
    };
  }

  if (categoryKey.includes("income_child_budget") || hasChildBudgetHint) {
    return {
      kind: "child_budget",
      budgetBucket: "childBudget",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
      expenseOffsetBucket: null,
      shortLabel: "Kindgebonden budget",
      groupLabel: "Structureel inkomen",
    };
  }

  if (
    (isBelastingdienst || isHealthInsuranceCategory(categoryKey)) &&
    (hasHealthRefundHint || isHealthInsuranceCategory(categoryKey))
  ) {
    return {
      kind: "expense_refund",
      budgetBucket: "costRefund",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: false,
      expenseOffsetBucket: "fixed_costs",
      shortLabel: "Kostencompensatie",
      groupLabel: "Kostencompensaties",
    };
  }

  if (
    (isBelastingdienst || isRoadTaxCategory(categoryKey)) &&
    (hasRoadTaxHint || isRoadTaxCategory(categoryKey))
  ) {
    return {
      kind: "expense_refund",
      budgetBucket: "costRefund",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: false,
      expenseOffsetBucket: "fixed_costs",
      shortLabel: "Belastingcorrectie",
      groupLabel: "Kostencompensaties",
    };
  }

  if (
    categoryKey.includes("income_tax_refund") ||
    (isBelastingdienst && hasTaxRefundHint)
  ) {
    return {
      kind: "tax_refund",
      budgetBucket: "windfall",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: true,
      expenseOffsetBucket: null,
      shortLabel: "Belastingmeevaller",
      groupLabel: "Incidentele meevallers",
    };
  }

  if (
    categoryKey.includes("income_benefits") ||
    (isBelastingdienst && hasGovernmentBenefitHint) ||
    hasGovernmentBenefitHint
  ) {
    return {
      kind: "structural_government",
      budgetBucket: "structuralOther",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
      expenseOffsetBucket: null,
      shortLabel: "Overheidsinkomen",
      groupLabel: "Structureel inkomen",
    };
  }

  if (
    input.analysisCategory === "income_structural" ||
    (categoryKey.startsWith("income_") && !categoryKey.includes("income_tax_refund"))
  ) {
    return {
      kind: "structural_other",
      budgetBucket: "structuralOther",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
      expenseOffsetBucket: null,
      shortLabel: "Structureel inkomen",
      groupLabel: "Structureel inkomen",
    };
  }

  if (budgetGroup === "fixed" || budgetGroup === "subscriptions") {
    return {
      kind: "expense_refund",
      budgetBucket: "costRefund",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: false,
      expenseOffsetBucket:
        budgetGroup === "subscriptions" ? "subscriptions" : "fixed_costs",
      shortLabel: "Kostencompensatie",
      groupLabel: "Kostencompensaties",
    };
  }

  return {
    kind: "variable_income",
    budgetBucket: "variable",
    analysisCategory: "income_variable",
    forecastEligible: true,
    countsAsIncome: true,
    expenseOffsetBucket: null,
    shortLabel: "Variabel inkomen",
    groupLabel: "Variabel inkomen",
  };
}

export function resolveIncomeSemantics(input: {
  amount: number;
  details: string;
  counterparty: string | null;
  categoryKey?: string | null;
  budgetGroup?: string | null;
  analysisCategory?:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
}) {
  return resolveIncomeSemanticsFromInput(input);
}

export function resolveIncomeSemanticsForTransaction<
  TCategoryMeta extends CategoryMeta,
>(
  tx: CategorizedRow,
  categoryById: Map<string, TCategoryMeta>,
) {
  const categoryId = tx.category_id_user || tx.category_id_auto || null;
  const categoryMeta = categoryId ? categoryById.get(categoryId) || null : null;

  return resolveIncomeSemanticsFromInput({
    amount: tx.amount,
    details: tx.details,
    counterparty: tx.counterparty,
    categoryKey: categoryMeta?.key || null,
    budgetGroup: categoryMeta?.budget_group || null,
    analysisCategory: tx.analysis_category || null,
  });
}
