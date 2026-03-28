/**
 * Shared label contracts for UI copy fragments.
 * Keep render trees dumb: selectors/services decide meaning, UI only renders labels.
 */

export type UnknownLabel = "Onbekend" | "Nog niet bekend";

export function fallbackLabel(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Onbekend";
}

export function boolLabel(value: boolean, truthy: string, falsy: string): string {
  return value ? truthy : falsy;
}

export type BudgetInclusionTone = "included" | "excluded";

export function getBudgetInclusionTogglePresentation(budgetExcluded: boolean): {
  iconName: "check-circle-outline" | "remove-circle-outline";
  label: "Binnen" | "Buiten";
  tone: BudgetInclusionTone;
} {
  if (budgetExcluded) {
    return {
      iconName: "remove-circle-outline",
      label: "Buiten",
      tone: "excluded",
    };
  }

  return {
    iconName: "check-circle-outline",
    label: "Binnen",
    tone: "included",
  };
}
