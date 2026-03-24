export type TransactionCleanupScope = "all" | "current_month";

export type TransactionCleanupScopeInfo = {
  scope: TransactionCleanupScope;
  label: string;
  subtitle: string;
  confirmationTitle: string;
  confirmationBody: string;
  startIso: string | null;
  endIso: string | null;
  monthLabel: string | null;
};

function resolveCurrentMonthInfo(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;

  return {
    key,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    startIso: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    endIso: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`,
  };
}

export function resolveTransactionCleanupScopeInfo(
  scope: TransactionCleanupScope,
  referenceDate = new Date(),
): TransactionCleanupScopeInfo {
  if (scope === "current_month") {
    const month = resolveCurrentMonthInfo(referenceDate);
    const monthLabel = month?.label || "de huidige maand";
    return {
      scope,
      label: "Huidige maand",
      subtitle: `Verwijder alle transacties van ${monthLabel}.`,
      confirmationTitle: `${monthLabel} wissen`,
      confirmationBody:
        `Dit verwijdert alle transacties van ${monthLabel}, inclusief categorisaties en auditlogs. ` +
        "Dit kan niet ongedaan gemaakt worden. Ben je zeker?",
      startIso: month?.startIso || null,
      endIso: month?.endIso || null,
      monthLabel,
    };
  }

  return {
    scope,
    label: "Alles",
    subtitle: "Verwijder alle transacties, categorisaties en auditlogs.",
    confirmationTitle: "Alle data verwijderen",
    confirmationBody:
      "Dit verwijdert alle transacties, categorisaties en auditlogs. Dit kan niet ongedaan gemaakt worden. Ben je zeker?",
    startIso: null,
    endIso: null,
    monthLabel: null,
  };
}

export function getTransactionCleanupSuccessMessage(
  scope: TransactionCleanupScope,
  deletedCount: number,
  referenceDate = new Date(),
) {
  const scopeInfo = resolveTransactionCleanupScopeInfo(scope, referenceDate);
  if (deletedCount <= 0) {
    return scope === "current_month"
      ? `Geen transacties gevonden in ${scopeInfo.monthLabel || "de huidige maand"}.`
      : "Geen transacties gevonden om te wissen.";
  }
  return scope === "current_month"
    ? `${deletedCount} transacties van ${scopeInfo.monthLabel || "de huidige maand"} gewist. Je kan nu opnieuw importeren.`
    : `${deletedCount} transacties gewist. Je kan nu opnieuw importeren.`;
}
