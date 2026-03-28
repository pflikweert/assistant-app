import type { UnifiedFinancialAdviceContext } from "@/services/help-assistant-financial-context";

const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export type SpendingQuestionType = "space_summary" | "spending_decision";

export type AdviceStrength = "low" | "medium" | "high";

export type AssistantRecommendedTone = "reassuring" | "neutral" | "cautious";

export type AssistantAdviceSignals = {
  budgetPressure: AdviceStrength;
  cashSafety: AdviceStrength;
  purchaseFlexibility: AdviceStrength;
  shortReason: string;
  recommendedTone: AssistantRecommendedTone;
};

export type SpendingAdviceRequiredBlocks = {
  monthBudget: boolean;
  cashflowSafety: boolean;
  expectedEndBalance: boolean;
  categoryStatus: boolean;
  weekContext: boolean;
  screenExplanation: boolean;
};

export const SPENDING_ADVICE_SYSTEM_PROMPT = [
  "Je bent de Budio AI Buddy voor bestedingsruimte-vragen.",
  "Je taak is voorzichtig, compact en bruikbaar meedenken over uitgavenruimte.",
  "Gebruik altijd canonieke Budio-termen uit de context.",
  "Budgetruimte, planning en forecast zijn leidend; los saldo is nooit leidend.",
  "Begin je conclusie altijd vanuit maandruimte en verwacht eindsaldo; weekruimte is alleen aanvullend.",
  "Maak steeds expliciet onderscheid tussen technisch mogelijk, binnen budget passend en financieel verstandig.",
  "Denk altijd in drie tijdslagen: nu, later deze maand en richting volgende inkomsten.",
  "Gebruik alleen data die expliciet in de huidige context staat.",
  "Noem null-waarden nooit als feitelijke bedragen of harde categoriegrenzen.",
  "Verzin nooit bedragen, datums, transacties, categorieën of risico's.",
  "Als data ontbreekt of beperkt is, benoem onzekerheid expliciet.",
  "Gebruik dan letterlijke veilige formulering: 'op basis van wat ik nu zie'.",
  "Gebruik deze fallbackvolgorde strikt: 1) category-specific canonical truth, 2) bucket-level truth, 3) month-level budget truth, 4) cashflow safety truth, 5) fallback explanatory truth.",
  "Als een categorie geen apart maandbudget heeft, zeg expliciet: 'Voor deze categorie heb ik nu geen apart maandbudget'.",
  "Geef geen absolute zekerheid en geen professioneel financieel advies.",
  "Vertaal technische signalen naar gewone taal; toon geen ruwe interne veldnamen.",
  "Je antwoord blijft altijd compact, menselijk en in het Nederlands.",
  "Geef in JSON ook een meta-blok terug met route='spending_advice', type='spending_advice' en context met screenId, screenTitle, routeName, platform en periodLabel.",
  "De bestaande velden conclusion, why, risk en nextStep blijven gewoon op root-niveau aanwezig.",
  "Output is exact JSON met verplichte velden: conclusion, why, risk, nextStep.",
  "Optioneel: confidence (low|medium|high) en dataGaps (korte labels).",
  'Geef uitsluitend JSON terug in dit formaat: {"conclusion":"...","why":"...","risk":"...","nextStep":"...","confidence":"low|medium|high","dataGaps":["..."]}',
].join(" ");

const SPENDING_SPACE_QUESTION_PROMPT = [
  "Vraagtype: ruimtevraag (bijv. 'hoeveel ruimte heb ik nog?').",
  "Start altijd met maandruimte als hoofdwaarheid en gebruik weekruimte alleen als aanvulling.",
  "Start met een directe samenvatting van de ruimte binnen maandbudget en forecast voor de gekozen periode.",
  "Gebruik waar mogelijk expliciete bedragen voor Resterend budget, Verwacht eindsaldo en Extra ruimte tot volgende inkomsten.",
  "Gebruik geen normatief oordeel als hoofdboodschap, tenzij data duidelijk onvoldoende is.",
  "why: noem kort de belangrijkste contextsignalen die de samenvatting dragen.",
  "risk: benoem kort het risico voor later deze maand en richting volgende inkomsten.",
  "nextStep: geef optioneel een kleine vervolgstap die direct helpt.",
  "Als ruimte niet betrouwbaar te bepalen is, kies in conclusion: 'onvoldoende data'.",
].join(" ");

const SPENDING_DECISION_QUESTION_PROMPT = [
  "Vraagtype: uitgavebeslissing (bijv. 'kan ik nog 40 euro uitgeven?').",
  "Bepaal eerst maandruimte en verwacht eindsaldo; gebruik weekruimte alleen als secundaire nuance.",
  "Geef in conclusion expliciet één richting: veilig, haalbaar maar krap, technisch mogelijk maar onverstandig, of onvoldoende data.",
  "Noem waar mogelijk expliciete bedragen voor deze aankoopimpact.",
  "why: onderbouw kort met maandbudget, categorieruimte als die er is, extra ruimte tot volgende inkomsten en verwacht eindsaldo.",
  "risk: benoem wat later deze maand of richting volgende inkomsten kan knellen.",
  "nextStep: geef een concrete kleine vervolgstap, zoals bedrag verlagen, wachten of eerst data controleren.",
].join(" ");

const CATEGORY_SPEND_HINTS = [
  "Als de gebruiker vraagt hoeveel er aan een categorie is uitgegeven, gebruik dan de categoryStatus of uitgavenverdeling in de context en noem een concreet maandbedrag.",
  "Als categorie-budgetdata ontbreekt, zeg dat expliciet en val terug op alleen het bestede bedrag plus maandcontext.",
].join(" ");

function cleanInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSpendingAdviceText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeBudgetSpaceQuestion(input: string) {
  const text = normalizeSpendingAdviceText(input);
  return (
    text.includes("ruimte") ||
    text.includes("uitgeven") ||
    text.includes("uitgegeven") ||
    text.includes("besteed") ||
    text.includes("kan ik nog") ||
    text.includes("kan ik een") ||
    text.includes("kan ik dit") ||
    text.includes("kopen") ||
    text.includes("bestedingsruimte") ||
    text.includes("budget")
  );
}

function looksLikeCategorySpendQuestion(input: string) {
  const text = normalizeSpendingAdviceText(input);
  return (
    text.includes("hoeveel heb ik aan") ||
    text.includes("hoeveel aan") ||
    text.includes("uitgegeven aan") ||
    text.includes("besteed aan") ||
    text.includes("gaf ik aan") ||
    text.includes("aan boodschappen") ||
    text.includes("aan eten") ||
    text.includes("aan supermarkt") ||
    text.includes("aan vervoer") ||
    text.includes("aan horeca") ||
    text.includes("aan kleding") ||
    text.includes("te veel uit aan")
  );
}

function looksLikeProblemOrBugQuestion(input: string) {
  const text = normalizeSpendingAdviceText(input);
  return (
    text.includes("waarom klopt") ||
    text.includes("klopt dit niet") ||
    text.includes("ik zie een fout") ||
    text.includes("dit werkt niet") ||
    text.includes("bug") ||
    text.includes("error")
  );
}

export function classifySpendingQuestionType(
  input: string,
): SpendingQuestionType | null {
  const text = normalizeSpendingAdviceText(input);
  if (looksLikeProblemOrBugQuestion(text)) return null;
  if (looksLikeCategorySpendQuestion(text)) return "spending_decision";
  if (!looksLikeBudgetSpaceQuestion(text)) return null;

  const isSpaceSummaryQuestion =
    text.includes("hoeveel ruimte") ||
    text.includes("ruimte heb ik nog") ||
    text.includes("ruimte over") ||
    text.includes("hoeveel kan ik nog") ||
    text.includes("heb ik nog ruimte");

  if (isSpaceSummaryQuestion) return "space_summary";
  return "spending_decision";
}

export function parseRequestedAmountFromQuestion(input: string) {
  const normalized = normalizeSpendingAdviceText(input).replace(",", ".");
  const euroMatch = /(?:€|\beuro\b)\s*(\d+(?:\.\d+)?)/.exec(normalized);
  if (euroMatch) {
    const parsed = Number(euroMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const trailingMatch = /\b(\d+(?:\.\d+)?)\b/.exec(normalized);
  if (!trailingMatch) return null;
  const parsed = Number(trailingMatch[1]);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0 || parsed > 200000) return null;
  return parsed;
}

export function buildSpendingAdvicePromptVariant(
  type: SpendingQuestionType,
) {
  return type === "space_summary"
    ? SPENDING_SPACE_QUESTION_PROMPT
    : SPENDING_DECISION_QUESTION_PROMPT;
}

function strengthRank(value: AdviceStrength) {
  if (value === "low") return 1;
  if (value === "medium") return 2;
  return 3;
}

function flexibilityRank(value: AdviceStrength) {
  return strengthRank(value);
}

function minFlexibility(...values: AdviceStrength[]) {
  return values.reduce((lowest, current) =>
    flexibilityRank(current) < flexibilityRank(lowest) ? current : lowest,
  );
}

function invertPressureToFlexibility(value: AdviceStrength): AdviceStrength {
  if (value === "high") return "low";
  if (value === "medium") return "medium";
  return "high";
}

function formatAmount(value: number | null | undefined) {
  return value == null ? "onbekend" : eur.format(value);
}

function formatImpact(value: number | null | undefined, amount: number | null) {
  if (value == null || amount == null) return "onbekend";
  // Purchase-impact remains intentionally simple:
  // subtraction over existing context values only (no new forecasting).
  return eur.format(value - amount);
}

function formatDataGapReason(value: string | null | undefined) {
  const cleaned = cleanInlineText(String(value || ""));
  return cleaned || "niet_gespecificeerd";
}

function subtractAmount(
  value: number | null | undefined,
  amount: number | null | undefined,
) {
  if (value == null || amount == null) return null;
  const result = value - amount;
  return Number.isFinite(result) ? Math.round(result * 100) / 100 : null;
}

function mapConfidenceScoreToStrength(
  score: "HIGH" | "MEDIUM" | "INDICATIVE" | null | undefined,
): AdviceStrength {
  if (score === "HIGH") return "high";
  if (score === "MEDIUM") return "medium";
  return "low";
}

export function buildAssistantAdviceSignals(input: {
  monthBudgetStatus: string | null | undefined;
  variableRemaining: number | null | undefined;
  variableBudgetTotal: number | null | undefined;
  extraSpaceUntilNextIncome: number | null | undefined;
  expectedEndBalance: number | null | undefined;
  lowestProjectedBalance: number | null | undefined;
  forecastReliabilityScore?: "HIGH" | "MEDIUM" | "INDICATIVE" | null;
  requestedAmount?: number | null;
  categoryStatus?: {
    status: string | null;
    remaining: number | null;
  } | null;
}): AssistantAdviceSignals {
  let budgetPressure: AdviceStrength = "medium";
  if (
    input.monthBudgetStatus === "over_budget" ||
    (input.variableRemaining != null && input.variableRemaining < 0)
  ) {
    budgetPressure = "high";
  } else if (
    input.monthBudgetStatus === "on_track" &&
    input.variableRemaining != null &&
    input.variableRemaining > 0
  ) {
    budgetPressure = "low";
  }

  let cashSafety: AdviceStrength = mapConfidenceScoreToStrength(
    input.forecastReliabilityScore,
  );
  if (
    input.expectedEndBalance != null &&
    input.expectedEndBalance < 0
  ) {
    cashSafety = "low";
  } else if (
    input.lowestProjectedBalance != null &&
    input.lowestProjectedBalance <= 25
  ) {
    cashSafety = "low";
  } else if (
    input.extraSpaceUntilNextIncome != null &&
    input.extraSpaceUntilNextIncome <= 50
  ) {
    cashSafety = "low";
  } else if (
    input.extraSpaceUntilNextIncome != null &&
    input.extraSpaceUntilNextIncome >= 200 &&
    cashSafety !== "low"
  ) {
    cashSafety = "high";
  }

  let amountFlexibility: AdviceStrength = "high";
  if (input.requestedAmount != null) {
    const amount = input.requestedAmount;
    if (
      (input.variableRemaining != null && amount > input.variableRemaining) ||
      (input.extraSpaceUntilNextIncome != null &&
        amount > input.extraSpaceUntilNextIncome) ||
      (input.expectedEndBalance != null &&
        input.expectedEndBalance - amount < 0) ||
      (input.categoryStatus?.remaining != null &&
        amount > input.categoryStatus.remaining)
    ) {
      amountFlexibility = "low";
    } else if (
      (input.variableRemaining != null &&
        input.variableRemaining > 0 &&
        amount > input.variableRemaining * 0.5) ||
      (input.extraSpaceUntilNextIncome != null &&
        input.extraSpaceUntilNextIncome > 0 &&
        amount > input.extraSpaceUntilNextIncome * 0.5)
    ) {
      amountFlexibility = "medium";
    }
  }

  if (input.categoryStatus?.status === "over_budget") {
    amountFlexibility = minFlexibility(amountFlexibility, "low");
  }

  const purchaseFlexibility = minFlexibility(
    invertPressureToFlexibility(budgetPressure),
    cashSafety,
    amountFlexibility,
  );

  let shortReason = "Je maandbeeld oogt op dit moment redelijk stabiel.";
  if (budgetPressure === "high") {
    shortReason = "Je variabele maandbudget staat al onder druk.";
  } else if (cashSafety === "low") {
    shortReason = "Je extra ruimte tot volgende inkomsten is nu krap.";
  } else if (input.categoryStatus?.status === "over_budget") {
    shortReason = "Deze categorie ligt nu al boven tempo voor deze maand.";
  } else if (purchaseFlexibility === "medium") {
    shortReason = "Het kan waarschijnlijk wel, maar deze keuze maakt je maand krapper.";
  }

  let recommendedTone: AssistantRecommendedTone = "neutral";
  if (budgetPressure === "low" && cashSafety === "high") {
    recommendedTone = "reassuring";
  } else if (budgetPressure === "high" || cashSafety === "low") {
    recommendedTone = "cautious";
  }

  return {
    budgetPressure,
    cashSafety,
    purchaseFlexibility,
    shortReason,
    recommendedTone,
  };
}

export function buildSpendingAdviceContextPrompt(input: {
  context: UnifiedFinancialAdviceContext;
  requestedAmount?: number | null;
  requiredBlocks?: Partial<SpendingAdviceRequiredBlocks> | null;
}) {
  const { context, requestedAmount = null } = input;
  const requiredBlocks = input.requiredBlocks || {};
  const spendingAdvice = context.spendingAdvice;
  const monthBudget = spendingAdvice.monthBudget;
  const cashflowSafety = spendingAdvice.cashflowSafety;
  const categoryStatus = spendingAdvice.categoryStatus;
  const signals = spendingAdvice.assistantAdviceSignals;
  const includeMonthBudget = requiredBlocks.monthBudget ?? true;
  const includeCashflowSafety = requiredBlocks.cashflowSafety ?? true;
  const includeExpectedEndBalance = requiredBlocks.expectedEndBalance ?? true;
  const includeCategoryStatus = requiredBlocks.categoryStatus ?? true;
  const includeWeekContext = requiredBlocks.weekContext ?? true;

  const lines: string[] = [
    "Assistant-ready bestedingscontext:",
    `Periode: ${context.period.label}`,
    "Fallbackvolgorde: 1) category-specific canonical truth, 2) bucket-level truth, 3) month-level budget truth, 4) cashflow safety truth, 5) fallback explanatory truth",
  ];
  if (includeMonthBudget) {
    lines.push(
      "",
      "Maandbudget:",
      `- Resterend budget ${monthBudget.monthLabel}: ${formatAmount(monthBudget.variableRemaining)}`,
      `- Variabel budget totaal: ${formatAmount(monthBudget.variableBudgetTotal)}`,
      `- Variabel besteed: ${formatAmount(monthBudget.variableSpent)}`,
      `- Maandstatus: ${cleanInlineText(monthBudget.monthBudgetStatusLabel || "onbekend")}`,
      `- Dagen resterend in maand: ${monthBudget.daysRemainingInMonth}`,
    );
    if (includeWeekContext) {
      lines.push(
        `- Weekbudget resterend: ${formatAmount(monthBudget.weekBudgetRemaining)}`,
        `- Weekstatus: ${cleanInlineText(monthBudget.weekBudgetStatus || "onbekend")}`,
        `- Weektempo-signaal: ${cleanInlineText(monthBudget.weekTempoSignal || "unknown")}`,
      );
    }
  }
  if (includeCashflowSafety || includeExpectedEndBalance) {
    lines.push(
      "",
      "Cashflow safety:",
      `- Actuele stand: ${formatAmount(cashflowSafety.currentBalance)}`,
      `- ${cashflowSafety.extraSpaceLabel}: ${formatAmount(cashflowSafety.extraSpaceUntilNextIncome)}`,
      `- Volgende inkomsten op: ${cashflowSafety.nextIncomeDate || "onbekend"}`,
      cashflowSafety.nextIncomeAmountMeta.isAvailable
        ? `- Volgende inkomsten bedrag: ${formatAmount(cashflowSafety.nextIncomeAmount)}`
        : `- Volgende inkomsten bedrag: niet betrouwbaar beschikbaar (${formatDataGapReason(cashflowSafety.nextIncomeAmountMeta.dataGapReason)})`,
      `- Volgende inkomsten bedrag bron: ${cashflowSafety.nextIncomeAmountMeta.source}`,
      `- Volgende inkomsten bedrag canonical: ${cashflowSafety.nextIncomeAmountMeta.isCanonical ? "ja" : "nee"}`,
      `- Volgende inkomsten bedrag fallback: ${cashflowSafety.nextIncomeAmountMeta.isFallback ? "ja" : "nee"}`,
      `- Dagen tot volgende inkomsten: ${cashflowSafety.daysUntilNextIncome ?? "onbekend"}`,
      `- Laagste verwachte stand: ${formatAmount(cashflowSafety.lowestProjectedBalance)}`,
      `- Bekende vaste kosten tot volgende inkomsten: ${formatAmount(cashflowSafety.knownUpcomingFixedCosts)}`,
      `- Verwachte vaste lasten en abonnementen: ${formatAmount(cashflowSafety.expectedFixedAndSubscriptions)}`,
      `- Forecastbetrouwbaarheid: ${cashflowSafety.forecastReliability}`,
    );
    if (includeExpectedEndBalance) {
      lines.push(
        `- Verwacht eindsaldo: ${formatAmount(cashflowSafety.expectedEndBalance)}`,
      );
    }
  }
  if (includeCategoryStatus) {
    lines.push(
      "",
      "Categoriecontext:",
      categoryStatus
        ? `- Categorie: ${categoryStatus.categoryLabel}`
        : "- Categorie: geen expliciete categorie in vraag gevonden",
      categoryStatus
        ? `- Besteed deze maand: ${formatAmount(categoryStatus.spentCurrentMonth)}`
        : "",
      categoryStatus
        ? categoryStatus.budgetAvailability === "canonical"
          ? `- Categoriebudget deze maand: ${formatAmount(categoryStatus.budgetCurrentMonth)}`
          : categoryStatus.budgetAvailability === "bucket_only"
            ? `- Categoriebudget op bucketniveau: ${formatAmount(categoryStatus.budgetCurrentMonth)}`
            : "- Voor deze categorie heb ik nu geen apart maandbudget"
        : "",
      categoryStatus
        ? `- Categorie resterend: ${formatAmount(categoryStatus.remaining)}`
        : "",
      categoryStatus
        ? `- Budgetbeschikbaarheid categorie: ${categoryStatus.budgetAvailability}`
        : "",
      categoryStatus
        ? `- Budgetbron categorie: ${categoryStatus.budgetSourceType}`
        : "",
      categoryStatus
        ? `- Budget-meta: source=${categoryStatus.budgetMeta.source}, canonical=${categoryStatus.budgetMeta.isCanonical ? "ja" : "nee"}, fallback=${categoryStatus.budgetMeta.isFallback ? "ja" : "nee"}, beschikbaar=${categoryStatus.budgetMeta.isAvailable ? "ja" : "nee"}, datagap=${formatDataGapReason(categoryStatus.budgetMeta.dataGapReason)}`
        : "",
      categoryStatus
        ? `- Categoriestatus: ${categoryStatus.status || "onbekend"}`
        : "",
      categoryStatus
        ? `- Projectie einde maand voor categorie: ${formatAmount(categoryStatus.projectedEndOfMonth)}`
        : "",
      categoryStatus
        ? `- Projectie-meta: source=${categoryStatus.projectedEndOfMonthMeta.source}, beschikbaar=${categoryStatus.projectedEndOfMonthMeta.isAvailable ? "ja" : "nee"}, datagap=${formatDataGapReason(categoryStatus.projectedEndOfMonthMeta.dataGapReason)}`
        : "",
      categoryStatus
        ? `- Gemiddelde laatste 3 maanden: ${formatAmount(categoryStatus.avgLast3Months)}`
        : "",
      categoryStatus
        ? `- Gemiddelde-meta: source=${categoryStatus.avgLast3MonthsMeta.source}, beschikbaar=${categoryStatus.avgLast3MonthsMeta.isAvailable ? "ja" : "nee"}, datagap=${formatDataGapReason(categoryStatus.avgLast3MonthsMeta.dataGapReason)}`
        : "",
    );
  }
  lines.push(
    "",
    "Samenvattingssignalen:",
    `- Budgetdruk: ${signals.budgetPressure}`,
    `- Cash safety: ${signals.cashSafety}`,
    `- Koopflexibiliteit: ${signals.purchaseFlexibility}`,
    `- Korte reden: ${signals.shortReason}`,
    `- Aanbevolen toon: ${signals.recommendedTone}`,
  );
  const cleanLines = lines.filter(Boolean);

  if (requestedAmount != null) {
    cleanLines.push(
      "",
      "Aankoopimpact:",
      "- Impactregel: eenvoudige aftrek op bestaande bedragen; geen nieuwe forecast of categorieprojectie.",
      `- Gevraagd bedrag: ${eur.format(requestedAmount)}`,
    );
    if (includeMonthBudget) {
      cleanLines.push(
        `- Resterend budget ${monthBudget.monthLabel} na aankoop: ${formatImpact(monthBudget.variableRemaining, requestedAmount)}`,
      );
    }
    if (includeCashflowSafety) {
      cleanLines.push(
        `- ${cashflowSafety.extraSpaceLabel} na aankoop: ${formatImpact(cashflowSafety.extraSpaceUntilNextIncome, requestedAmount)}`,
      );
    }
    if (includeExpectedEndBalance) {
      cleanLines.push(
        `- Verwacht eindsaldo na aankoop: ${formatImpact(cashflowSafety.expectedEndBalance, requestedAmount)}`,
      );
    }
    if (includeCategoryStatus && categoryStatus) {
      cleanLines.push(
        `- Categorie resterend na aankoop: ${formatImpact(categoryStatus.remaining, requestedAmount)}`,
      );
    }
  }

  const readableDataGaps = context.quality.dataGaps
    .map((gap) => String(gap || "").trim())
    .filter(Boolean);

  if (readableDataGaps.length) {
    cleanLines.push("", `Datagaten: ${readableDataGaps.join(", ")}`);
  }

  const machinePayload: Record<string, unknown> = {
    periodLabel: context.period.label,
    requiredBlocks: {
      monthBudget: includeMonthBudget,
      cashflowSafety: includeCashflowSafety,
      expectedEndBalance: includeExpectedEndBalance,
      categoryStatus: includeCategoryStatus,
      weekContext: includeWeekContext,
    },
    assistantAdviceSignals: signals,
    requestedAmount,
    purchaseImpact:
      requestedAmount == null
        ? null
        : {
            requestedAmount,
            monthRemainingAfterPurchase: includeMonthBudget
              ? subtractAmount(monthBudget.variableRemaining, requestedAmount)
              : null,
            extraSpaceAfterPurchase: includeCashflowSafety
              ? subtractAmount(
                  cashflowSafety.extraSpaceUntilNextIncome,
                  requestedAmount,
                )
              : null,
            expectedEndBalanceAfterPurchase: includeExpectedEndBalance
              ? subtractAmount(cashflowSafety.expectedEndBalance, requestedAmount)
              : null,
            categoryRemainingAfterPurchase:
              includeCategoryStatus && categoryStatus
                ? subtractAmount(categoryStatus.remaining, requestedAmount)
                : null,
          },
    dataGaps: context.quality.dataGaps,
  };
  if (includeMonthBudget) {
    machinePayload.monthBudget = {
      monthLabel: monthBudget.monthLabel,
      variableBudgetTotal: monthBudget.variableBudgetTotal,
      variableSpent: monthBudget.variableSpent,
      variableRemaining: monthBudget.variableRemaining,
      monthBudgetStatus: monthBudget.monthBudgetStatus,
      monthBudgetStatusLabel: monthBudget.monthBudgetStatusLabel,
      weekBudgetRemaining: includeWeekContext
        ? monthBudget.weekBudgetRemaining
        : null,
      weekBudgetStatus: includeWeekContext ? monthBudget.weekBudgetStatus : null,
      weekTempoSignal: includeWeekContext ? monthBudget.weekTempoSignal : null,
    };
  }
  if (includeCashflowSafety || includeExpectedEndBalance) {
    machinePayload.cashflowSafety = {
      currentBalance: cashflowSafety.currentBalance,
      extraSpaceUntilNextIncome: cashflowSafety.extraSpaceUntilNextIncome,
      extraSpaceLabel: cashflowSafety.extraSpaceLabel,
      nextIncomeDate: cashflowSafety.nextIncomeDate,
      nextIncomeAmount: cashflowSafety.nextIncomeAmount,
      nextIncomeAmountMeta: cashflowSafety.nextIncomeAmountMeta,
      expectedEndBalance: includeExpectedEndBalance
        ? cashflowSafety.expectedEndBalance
        : null,
      lowestProjectedBalance: cashflowSafety.lowestProjectedBalance,
      knownUpcomingFixedCosts: cashflowSafety.knownUpcomingFixedCosts,
      expectedFixedAndSubscriptions: cashflowSafety.expectedFixedAndSubscriptions,
      forecastReliability: cashflowSafety.forecastReliability,
    };
  }
  if (includeCategoryStatus) {
    machinePayload.categoryStatus = categoryStatus;
  }

  cleanLines.push(
    "",
    "SpendingAdvice truth-safe payload JSON:",
    JSON.stringify(machinePayload),
  );

  cleanLines.push("", CATEGORY_SPEND_HINTS);

  return cleanLines.join("\n");
}
