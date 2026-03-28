import type { ForecastCarryover, ForecastEvent } from "@/services/forecast-domain";
import { normalizeForecastCertainty } from "@/services/forecast-domain";
import { resolveForecastAccountRules } from "@/services/forecast-account-rules";
import { resolveIncomeSemanticsForTransaction } from "@/services/income-semantics";
import type { CategoryRecord, RecurringType } from "@/types/categorization";

const OWN_ACCOUNT_TRANSFER_HINTS = [
  "eigen rekening",
  "overboeking eigen rekening",
  "naar eigen rekening",
  "tussen eigen rekeningen",
  "interne overboeking",
  "tb eigen rekening",
];

type ForecastAccountInputLike = {
  account_type?: string | null;
  name?: string | null;
  provider?: string | null;
  is_active?: boolean | null;
  owner_scope?: "personal" | "shared" | "child" | "external" | null;
  forecast_role?:
    | "operational"
    | "reserve"
    | "goal"
    | "shared"
    | "observation_only"
    | "excluded"
    | null;
  include_in_cashflow?: boolean | null;
  include_in_budget?: boolean | null;
  include_in_net_worth?: boolean | null;
};

type BookedTransactionInput = {
  id: string;
  date: string;
  amount: number;
  details: string;
  counterparty: string | null;
  analysis_main_group: "income" | "expense" | null;
  analysis_category:
    | "fixed_costs"
    | "subscriptions"
    | "variable_costs"
    | "savings_transfer"
    | "income_structural"
    | "income_variable"
    | null;
  recurring: boolean;
  recurring_type: RecurringType | null;
  category_id_auto: string | null;
  category_id_user: string | null;
  bank_account_id: string | null;
  budget_excluded: boolean;
  metadata: Record<string, unknown>;
};

export type ForecastTimelineEventLike = {
  date: string;
  label: string;
  amount: number;
  kind: "income" | "fixed_cost" | "subscription" | "savings_transfer";
  source:
    | "income_source"
    | "recurring_history"
    | "subscription_profile"
    | "rare_subscription"
    | "derived";
  confidence: "medium" | "high";
  referenceTransactionId?: string | null;
  referenceCategoryId?: string | null;
  referenceCategoryPath?: string | null;
  referenceLabel?: string | null;
  referenceSourceType?:
    | "transaction"
    | "income_source"
    | "subscription_profile"
    | "rare_subscription"
    | "derived"
    | null;
  incomeBucket?: string | null;
};

export type ForecastEventNormalizationInput = {
  monthStart: Date;
  monthEndExclusive: Date;
  referenceDate: Date;
  categoryMap: Map<string, CategoryRecord>;
  bankAccountsById?: Map<string, ForecastAccountInputLike>;
  bookedTransactions?: BookedTransactionInput[];
  timelineEvents?: ForecastTimelineEventLike[];
  reserveRules?: {
    id: string;
    label: string;
    monthlyAmount: number;
    status: "active" | "paused";
    scopeView?: "personal" | "shared" | "household" | "observation";
  }[];
  carryover?: ForecastCarryover | null;
};

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function hasOwnAccountTransferHint(input: {
  details: string;
  counterparty: string | null;
}) {
  const haystack = normalizeText(`${input.counterparty || ""} ${input.details || ""}`);
  if (!haystack) return false;
  return OWN_ACCOUNT_TRANSFER_HINTS.some((hint) => haystack.includes(hint));
}

function resolveForecastAccountMetadata(account: ForecastAccountInputLike) {
  // Explicit account metadata wins over the older read-time heuristics so the
  // same scope/role meaning is used everywhere in the forecast surface.
  const rules = resolveForecastAccountRules(account);
  return {
    forecastRole: rules.forecast_role,
    ownerScope: rules.owner_scope,
  };
}

function resolveBookedTransactionAccountMetadata(
  tx: BookedTransactionInput,
  bankAccountsById?: Map<string, ForecastAccountInputLike>,
) {
  const account = tx.bank_account_id
    ? bankAccountsById?.get(tx.bank_account_id) || null
    : null;
  // Tijdelijke read-time inferentie: zolang accountrollen nog niet persistent
  // zijn, bepalen we ze hier op basis van bestaande accountmetadata.
  return resolveForecastAccountMetadata(account || {
    account_type: "other",
    name: null,
    provider: null,
    is_active: true,
  });
}

function buildForecastEventId(parts: (string | null | undefined)[]) {
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join("|");
}

function resolveBookedTransactionEvent(
  tx: BookedTransactionInput,
  categoryMap: Map<string, CategoryRecord>,
  bankAccountsById?: Map<string, ForecastAccountInputLike>,
): ForecastEvent | null {
  if (tx.amount === 0) return null;
  if (tx.budget_excluded) return null;

  const semantics = resolveIncomeSemanticsForTransaction(tx, categoryMap);
  const accountMetadata = resolveBookedTransactionAccountMetadata(tx, bankAccountsById);
  const ownerScope = accountMetadata.ownerScope;
  const accountRole = accountMetadata.forecastRole;
  const label = String(tx.counterparty || tx.details.split("|")[0] || tx.details || "").trim() || "Onbekend";
  const baseId = buildForecastEventId([tx.id, tx.date, label]);

  if (tx.amount > 0 && semantics.countsAsIncome) {
    return {
      id: `income:${baseId}`,
      date: tx.date,
      type: "income",
      certainty: "booked",
      moneyLayer: "operational",
      amount: round2(Math.abs(tx.amount)),
      label,
      accountRole,
      ownerScope,
      timelineKind: "income",
      timelineSource: "derived",
      referenceId: tx.id,
      sourceLabel: label,
    };
  }

  if (tx.analysis_category === "savings_transfer") {
    const amount = round2(Math.abs(tx.amount));
    return {
      id: `reserve:${baseId}`,
      date: tx.date,
      type: "reserve_allocation",
      certainty: "booked",
      moneyLayer: "reserved",
      amount,
      label,
      accountRole,
      ownerScope,
      timelineKind: "savings_transfer",
      timelineSource: "derived",
      carryover: {
        sourceMonthStart: null,
        targetMonthStart: null,
        sourceMoneyLayer: "operational",
        targetMoneyLayer: "reserved",
        amount,
        certainty: "booked",
        sourceEventType: "reserve_allocation",
        sourceLabel: label,
        reason: "Interne reserveboeking",
      },
      referenceId: tx.id,
      sourceLabel: label,
    };
  }

  if (
    tx.amount < 0 &&
    (semantics.kind === "internal_transfer" ||
      hasOwnAccountTransferHint({
        details: tx.details,
        counterparty: tx.counterparty,
      }))
  ) {
    const amount = round2(Math.abs(tx.amount));
    return {
      id: `transfer:${baseId}`,
      date: tx.date,
      type: "internal_transfer",
      certainty: "booked",
      moneyLayer: "operational",
      amount,
      label,
      accountRole,
      ownerScope,
      timelineKind: null,
      timelineSource: "derived",
      referenceId: tx.id,
      sourceLabel: label,
    };
  }

  if (tx.amount < 0 && tx.analysis_main_group === "expense") {
    const amount = round2(Math.abs(tx.amount));
    return {
      id: `expense:${baseId}`,
      date: tx.date,
      type: "expense",
      certainty: "booked",
      moneyLayer: "operational",
      amount,
      label,
      accountRole,
      ownerScope,
      timelineKind:
        tx.analysis_category === "subscriptions" ? "subscription" : "fixed_cost",
      timelineSource: "derived",
      referenceId: tx.id,
      sourceLabel: label,
    };
  }

  return null;
}

function resolveTimelineEventCertainty(
  event: ForecastTimelineEventLike,
): ForecastEvent["certainty"] {
  if (event.source === "income_source") return "committed";
  if (event.source === "subscription_profile") return "committed";
  if (event.source === "recurring_history") return "inferred";
  if (event.source === "rare_subscription") return "inferred";
  return normalizeForecastCertainty(event.confidence === "high" ? "committed" : "estimated");
}

function resolveTimelineEventType(event: ForecastTimelineEventLike): ForecastEvent["type"] {
  if (event.kind === "income") return "income";
  if (event.kind === "savings_transfer") return "reserve_allocation";
  return "expense";
}

function resolveTimelineEventMoneyLayer(event: ForecastTimelineEventLike): ForecastEvent["moneyLayer"] {
  if (event.kind === "savings_transfer") return "reserved";
  return "operational";
}

function resolveTimelineEventAccountRole(event: ForecastTimelineEventLike): ForecastEvent["accountRole"] {
  if (event.kind === "savings_transfer") return "reserve";
  return "operational";
}

function resolveTimelineEventOwnerScope(event: ForecastTimelineEventLike): ForecastEvent["ownerScope"] {
  if (event.source === "subscription_profile") return "shared";
  return "personal";
}

function mapTimelineEvent(event: ForecastTimelineEventLike): ForecastEvent {
  const label = String(event.label || "").trim() || "Onbekend";
  const amount = round2(Math.abs(event.amount));
  const type = resolveTimelineEventType(event);
  const moneyLayer = resolveTimelineEventMoneyLayer(event);
  return {
    id: buildForecastEventId([event.date, label, event.source]),
    date: event.date,
    type,
    certainty: resolveTimelineEventCertainty(event),
    moneyLayer,
    amount: type === "income" ? amount : amount,
    label,
    accountRole: resolveTimelineEventAccountRole(event),
    ownerScope: resolveTimelineEventOwnerScope(event),
    timelineKind: event.kind,
    timelineSource: event.source,
    referenceId: event.referenceTransactionId || null,
    sourceLabel: event.referenceLabel || label,
    carryover:
      event.kind === "savings_transfer"
        ? {
            sourceMonthStart: null,
            targetMonthStart: null,
            sourceMoneyLayer: "operational",
            targetMoneyLayer: "reserved",
            amount,
            certainty: resolveTimelineEventCertainty(event),
            sourceEventType: "reserve_allocation",
            sourceLabel: event.referenceLabel || label,
            reason: "Geplande spaarboeking",
          }
        : null,
  };
}

function normalizeKey(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveReserveRuleOwnerScope(
  scopeView?: "personal" | "shared" | "household" | "observation",
): ForecastEvent["ownerScope"] {
  if (scopeView === "shared" || scopeView === "household") return "shared";
  if (scopeView === "observation") return "external";
  return "personal";
}

function hasReserveRuleLabelMatch(
  labels: Set<string>,
  values: (string | null | undefined)[],
) {
  const normalizedValues = values
    .map((value) => normalizeKey(String(value || "")))
    .filter(Boolean);
  for (const value of normalizedValues) {
    if (labels.has(value)) return true;
    for (const label of labels) {
      if (!label) continue;
      if (value.includes(label) || label.includes(value)) {
        return true;
      }
    }
  }
  return false;
}

export function normalizeForecastEventsForMonth(
  input: ForecastEventNormalizationInput,
): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  const monthStartIso = dateToIso(input.monthStart);
  const monthEndIso = dateToIso(input.monthEndExclusive);
  const referenceIso = dateToIso(input.referenceDate);

  const activeReserveRuleLabels = new Set(
    (input.reserveRules || [])
      .filter((rule) => rule.status === "active")
      .map((rule) => normalizeKey(rule.label)),
  );

  for (const tx of input.bookedTransactions || []) {
    if (tx.date < monthStartIso || tx.date >= monthEndIso) continue;
    // Tijdelijke bridge: de opening bevat al de bekende stand tot en met de
    // referentiedatum, dus alleen nog latere transacties horen in de
    // forecast-eventlaag.
    if (tx.date <= referenceIso) continue;
    const event = resolveBookedTransactionEvent(
      tx,
      input.categoryMap,
      input.bankAccountsById,
    );
    if (
      event?.type === "expense" &&
      (tx.analysis_category === "fixed_costs" ||
        tx.analysis_category === "subscriptions") &&
      hasReserveRuleLabelMatch(activeReserveRuleLabels, [
        event.label,
        tx.counterparty,
        tx.details,
      ])
    ) {
      // Anti-double-counting: if a fixed/subscription obligation is already
      // covered by an active annual reserve rule in this horizon, keep only
      // the reserve allocation path.
      continue;
    }
    if (event) events.push(event);
  }

  for (const event of input.timelineEvents || []) {
    if (event.date < monthStartIso || event.date >= monthEndIso) continue;
    if (event.date <= referenceIso) continue;
    if (
      (event.kind === "fixed_cost" || event.kind === "subscription") &&
      activeReserveRuleLabels.has(normalizeKey(event.label))
    ) {
      // Anti-double-counting: active annual reserve rules already model this
      // obligation as reserve allocation, so do not add a second expense event.
      continue;
    }
    events.push(mapTimelineEvent(event));
  }

  for (const rule of input.reserveRules || []) {
    if (rule.status !== "active") continue;
    const amount = round2(Math.max(Math.abs(rule.monthlyAmount), 0));
    if (amount <= 0) continue;
    // Plan reserve allocations vanaf de eerstvolgende dag in de maandhorizon,
    // zodat de maandnormalisatie voor de rest-van-de-maand ook echt een event krijgt.
    const scheduleDay = Math.min(
      28,
      Math.max(1, new Date(input.referenceDate).getDate() + 1),
    );
    const ruleDate = `${monthStartIso.slice(0, 8)}${String(scheduleDay).padStart(2, "0")}`;
    if (ruleDate <= referenceIso || ruleDate >= monthEndIso) continue;
    events.push({
      id: `reserve-rule:${rule.id}:${ruleDate}`,
      date: ruleDate,
      type: "reserve_allocation",
      certainty: "committed",
      moneyLayer: "reserved",
      amount,
      label: rule.label,
      accountRole: "reserve",
      ownerScope: resolveReserveRuleOwnerScope(rule.scopeView),
      timelineKind: "savings_transfer",
      timelineSource: "derived",
      referenceId: rule.id,
      sourceLabel: rule.label,
      carryover: {
        sourceMonthStart: null,
        targetMonthStart: null,
        sourceMoneyLayer: "operational",
        targetMoneyLayer: "reserved",
        amount,
        certainty: "committed",
        sourceEventType: "reserve_allocation",
        sourceLabel: rule.label,
        reason: "Maandelijkse reservering jaarlijkse verplichting",
      },
    });
  }

  const deduped = new Map<string, ForecastEvent>();
  for (const event of events) {
    const key = buildForecastEventId([
      event.date,
      event.type,
      event.label,
      String(event.amount),
      event.moneyLayer,
    ]);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, event);
      continue;
    }
    if (existing.certainty === "estimated" && event.certainty !== "estimated") {
      deduped.set(key, event);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.type !== right.type) return left.type.localeCompare(right.type);
    if (left.amount !== right.amount) return left.amount - right.amount;
    return left.label.localeCompare(right.label, "nl");
  });
}
