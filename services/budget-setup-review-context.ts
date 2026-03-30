import type { BudgetSetupProposal } from "@/services/budget-setup-proposal-schema";

export type BudgetSetupReviewContext = {
  monthKey: string;
  monthStartIso: string;
  adjustmentCount: number;
  proposal: BudgetSetupProposal;
};

let reviewContext: BudgetSetupReviewContext | null = null;

export function setBudgetSetupReviewContext(context: BudgetSetupReviewContext) {
  reviewContext = context;
}

export function getBudgetSetupReviewContext() {
  return reviewContext;
}

export function clearBudgetSetupReviewContext() {
  reviewContext = null;
}
