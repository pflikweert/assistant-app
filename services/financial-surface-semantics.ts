import type { FinanceStatusTone } from "@/components/ui/finance-status-chip";

export type FinancialSurfaceTermKey =
  | "remainingMonthlyBudget"
  | "expectedEndOperationalBalance"
  | "safeToSpendUntilNextIncome"
  | "freeToSpendNow";

export type FinancialSurfaceTermDefinition = {
  key: FinancialSurfaceTermKey;
  label: string;
  description: string;
};

export type FinancialSurfaceStatusOutput = {
  label: string;
  tone: FinanceStatusTone;
  helperText: string;
  iconName: "check-circle-outline" | "warning";
};

export type SafetyContextOutput = {
  primaryLabel: "Extra ruimte";
  contextLabel: "tot salaris" | "tot volgende inkomsten";
  fullLabel: string;
  sheetTitle: string;
  sheetSubtitle: string;
};

const SAFETY_SALARY_HINTS = ["salaris", "loon"];

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isSalaryLikeAnchor(anchorLabel: string | null | undefined) {
  const label = normalize(anchorLabel);
  return SAFETY_SALARY_HINTS.some((hint) => label.includes(hint));
}

export function getFinancialSurfaceTermDefinition(
  key: FinancialSurfaceTermKey,
): FinancialSurfaceTermDefinition {
  switch (key) {
    case "remainingMonthlyBudget":
      return {
        key,
        label: "Resterend budget",
        description: "Wat je deze maand binnen je variabele budget nog over hebt.",
      };
    case "expectedEndOperationalBalance":
      return {
        key,
        label: "Verwacht eindsaldo",
        description:
          "Waar je operationele stand deze maand waarschijnlijk op uitkomt.",
      };
    case "safeToSpendUntilNextIncome":
      return {
        key,
        label: "Extra ruimte",
        description:
          "Voorzichtige bestedingsruimte tot je volgende hoofdinkomstenmoment.",
      };
    case "freeToSpendNow":
      return {
        key,
        label: "Vrij besteedbaar",
        description: "Operationele ruimte van nu, los van maandbudget en forecast.",
      };
  }
}

export function resolveSafetyContextCopy(input: {
  anchorLabel?: string | null;
  anchorDate?: string | null;
  isEstimatedAnchorDate?: boolean;
  formatDateLabel?: ((isoDate: string) => string | null) | null;
}): SafetyContextOutput {
  const hasSalaryAnchor = isSalaryLikeAnchor(input.anchorLabel);
  const contextLabel = hasSalaryAnchor
    ? "tot salaris"
    : "tot volgende inkomsten";
  const fullLabel = `Extra ruimte ${contextLabel}`;
  const sheetTitle = hasSalaryAnchor ? "Veilig tot salaris" : "Extra ruimte";
  const formattedDate = input.anchorDate
    ? input.formatDateLabel?.(input.anchorDate) || null
    : null;

  if (hasSalaryAnchor) {
    if (input.isEstimatedAnchorDate && formattedDate) {
      return {
        primaryLabel: "Extra ruimte",
        contextLabel,
        fullLabel,
        sheetTitle,
        sheetSubtitle: `Tot naar verwachting je salaris komt (ca. ${formattedDate})`,
      };
    }
    return {
      primaryLabel: "Extra ruimte",
      contextLabel,
      fullLabel,
      sheetTitle,
      sheetSubtitle: "Tot je salaris",
    };
  }

  if (input.isEstimatedAnchorDate && formattedDate) {
    return {
      primaryLabel: "Extra ruimte",
      contextLabel,
      fullLabel,
      sheetTitle,
      sheetSubtitle: `Tot naar verwachting je volgende inkomsten komen (ca. ${formattedDate})`,
    };
  }

  return {
    primaryLabel: "Extra ruimte",
    contextLabel,
    fullLabel,
    sheetTitle,
    sheetSubtitle: formattedDate
      ? "Tot je volgende inkomsten"
      : "Tot je volgende inkomensmoment",
  };
}

export function resolveFinancialSurfaceStatus(input: {
  activeMonthLabel: string;
  expectedEndOperationalBalance: number | null;
  remainingMonthlyBudget: number | null;
  monthBudgetTone?: FinanceStatusTone | null;
}): FinancialSurfaceStatusOutput {
  const month = input.activeMonthLabel;
  const hasCriticalBudgetPressure =
    input.monthBudgetTone === "critical" ||
    (input.remainingMonthlyBudget != null && input.remainingMonthlyBudget < 0);
  const hasForecastDeficit =
    input.expectedEndOperationalBalance != null &&
    input.expectedEndOperationalBalance < 0;

  if (hasForecastDeficit || hasCriticalBudgetPressure) {
    return {
      label: `Let op voor ${month}`,
      tone: "critical",
      helperText:
        "Je huidige maandtempo of verwachte eindstand vraagt extra voorzichtigheid.",
      iconName: "warning",
    };
  }

  if (input.expectedEndOperationalBalance == null) {
    return {
      label: `Forecast volgt voor ${month}`,
      tone: "neutral",
      helperText: "We tonen deze status zodra de maandverwachting betrouwbaar is.",
      iconName: "check-circle-outline",
    };
  }

  return {
    label: `Je zit op schema voor ${month}`,
    tone: "good",
    helperText: "Je maandbeeld oogt stabiel op basis van je huidige budget en forecast.",
    iconName: "check-circle-outline",
  };
}

