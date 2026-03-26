import { describe, expect, it } from "vitest";

import { resolveIncomeSemantics } from "./income-semantics";

describe("resolveIncomeSemantics", () => {
  it("treats tax refunds as incidental windfalls instead of structural income", () => {
    const result = resolveIncomeSemantics({
      amount: 842.13,
      counterparty: "Belastingdienst",
      details: "Voorlopige aanslag teruggave inkomstenbelasting",
      categoryKey: "income_tax_refund",
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "tax_refund",
      budgetBucket: "windfall",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: true,
      shortLabel: "Belastingmeevaller",
    });
  });

  it("keeps kindgebonden budget as structural income", () => {
    const result = resolveIncomeSemantics({
      amount: 251,
      counterparty: "Belastingdienst",
      details: "Voorschot KIT/KGB",
      categoryKey: "income_child_budget",
      analysisCategory: "income_structural",
    });

    expect(result).toMatchObject({
      kind: "child_budget",
      budgetBucket: "childBudget",
      analysisCategory: "income_structural",
      forecastEligible: true,
    });
  });

  it("treats toeslagen and tegemoetkomingen as structural government income", () => {
    const result = resolveIncomeSemantics({
      amount: 312.4,
      counterparty: "Belastingdienst",
      details: "Huurtoeslag december",
      categoryKey: null,
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "structural_government",
      budgetBucket: "structuralOther",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
    });
  });

  it("keeps explicit benefit leaf categories structural even with stale analysis", () => {
    const result = resolveIncomeSemantics({
      amount: 410,
      counterparty: "Gemeente",
      details: "Persoonsgebonden budget",
      categoryKey: "income_benefits_pgb",
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "structural_government",
      budgetBucket: "structuralOther",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
    });
  });

  it("treats positive bijdrage zvw settlements as cost refunds", () => {
    const result = resolveIncomeSemantics({
      amount: 129.44,
      counterparty: "Belastingdienst",
      details: "Bijdrage ZVW afrekening",
      categoryKey: "care_health_insurance",
      budgetGroup: "fixed",
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "expense_refund",
      budgetBucket: "costRefund",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: false,
      expenseOffsetBucket: "fixed_costs",
    });
  });

  it("treats road tax corrections as cost refunds instead of income", () => {
    const result = resolveIncomeSemantics({
      amount: 48,
      counterparty: "Belastingdienst",
      details: "Teruggave wegenbelasting MRB",
      categoryKey: "auto_transport_road_tax",
      budgetGroup: "fixed",
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "expense_refund",
      countsAsIncome: false,
      expenseOffsetBucket: "fixed_costs",
    });
  });

  it("falls back to recurring-eligible variable income for generic inflows", () => {
    const result = resolveIncomeSemantics({
      amount: 75,
      counterparty: "Marktplaats",
      details: "Verkoop fiets",
      categoryKey: null,
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "variable_income",
      budgetBucket: "variable",
      analysisCategory: "income_variable",
      forecastEligible: true,
      countsAsIncome: true,
    });
  });

  it("uses the salary category instead of salary text hints", () => {
    const result = resolveIncomeSemantics({
      amount: 2400,
      counterparty: "Impres B.V.",
      details: "Salaris maart",
      categoryKey: "income_salary",
      analysisCategory: "income_structural",
    });

    expect(result).toMatchObject({
      kind: "salary",
      budgetBucket: "salary",
      analysisCategory: "income_structural",
      forecastEligible: true,
      countsAsIncome: true,
    });
  });

  it("classifies savings-account interest as a non-forecast income signal", () => {
    const result = resolveIncomeSemantics({
      amount: 4.21,
      counterparty: "Rabobank",
      details: "Rentebijschrijving spaarrente",
      categoryKey: "income_savings_interest",
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "savings_interest",
      budgetBucket: "windfall",
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: true,
      shortLabel: "Spaarrente",
    });
  });

  it("treats internal transfers between own accounts as non-income", () => {
    const result = resolveIncomeSemantics({
      amount: 500,
      counterparty: "Rabobank",
      details: "Overboeking eigen rekening | tb = eigen rekening",
      categoryKey: "savings_investing_internal_transfer",
      budgetGroup: "savings",
      analysisCategory: "income_variable",
    });

    expect(result).toMatchObject({
      kind: "internal_transfer",
      budgetBucket: null,
      analysisCategory: "income_variable",
      forecastEligible: false,
      countsAsIncome: false,
      shortLabel: "Eigen overboeking",
    });
  });

  it("does not classify unlabeled salary text as salary without a salary category", () => {
    const result = resolveIncomeSemantics({
      amount: 2400,
      counterparty: "Impres B.V.",
      details: "Salaris maart",
      categoryKey: null,
      analysisCategory: "income_structural",
    });

    expect(result.kind).toBe("structural_other");
    expect(result.budgetBucket).toBe("structuralOther");
  });
});
