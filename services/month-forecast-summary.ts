import { requireCurrentUserId } from "@/services/current-user";
import { ensureForecastFresh } from "@/services/forecast-refresh";
import {
  normalizeMoneyViewScope,
  type MoneyViewScope,
} from "@/services/finance-scope";
import {
  adaptForecastMonthStateToLegacySummary,
  buildForecastMonthStateFromLegacySummary,
} from "@/services/forecast-summary-adapter";
import { loadLatestKnownBalanceSnapshot } from "@/services/latest-known-balance";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import { supabase } from "@/services/supabase";

function isMissingColumnError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42703" || code === "PGRST204") return true;

  return (
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("could not find")
  );
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || "");
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function startOfMonthIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function resolveForecastReason(monthStartIso: string, now = new Date()) {
  const currentMonthStartIso = startOfMonthIso(now);
  if (monthStartIso === currentMonthStartIso) return "budget_surface_current";
  if (monthStartIso < currentMonthStartIso) return "budget_surface_historical";
  return "budget_surface_future";
}

function isCurrentMonth(monthStartIso: string, referenceDate: Date) {
  return monthStartIso === startOfMonthIso(referenceDate);
}

export async function loadMonthForecastSummary(params: {
  monthStartIso: string;
  referenceDate: Date;
  reason?: string;
  moneyViewScope?: MoneyViewScope;
  userId?: string;
}): Promise<InsightsForecastSummary | null> {
  const { monthStartIso, referenceDate, userId } = params;
  const moneyViewScope = normalizeMoneyViewScope(params.moneyViewScope);

  try {
    const resolvedUserId = userId || (await requireCurrentUserId());

    await ensureForecastFresh({
      reason: params.reason || resolveForecastReason(monthStartIso),
      referenceDate,
      moneyViewScope,
    }).catch(() => null);

    const fetchLatest = async () =>
      supabase
        .from("monthly_cashflow_forecasts")
        .select(
          "month_start,scope_view,forecast_reference_date,current_balance_anchor,current_balance_anchor_date,cash_risk_flag,risk_flag,expected_end_of_month_balance,lowest_expected_balance,lowest_expected_balance_date,next_expected_event_date,next_expected_event_label,expected_income_total,remaining_expected_income_total,remaining_expected_expense_total,remaining_expected_savings_outflow_total,upcoming_committed_income_total,upcoming_committed_expense_total,expected_fixed_costs,expected_subscriptions,expected_variable_costs,avg_groceries,avg_fuel,avg_smoking,avg_other_variable,top_cost_bucket_1,top_cost_bucket_2,top_cost_bucket_3",
        )
        .eq("user_id", resolvedUserId)
        .eq("month_start", monthStartIso)
        .eq("scope_view", moneyViewScope)
        .maybeSingle();

    const fetchLegacy = async () =>
      supabase
        .from("monthly_cashflow_forecasts")
        .select("month_start,risk_flag,expected_end_of_month_balance")
        .eq("user_id", resolvedUserId)
        .eq("month_start", monthStartIso)
        .maybeSingle();

    let result: any = await fetchLatest();
    if (result.error && isMissingColumnError(result.error)) {
      result = await fetchLegacy();
    }

    if (result.error) {
      if (isMissingRelationError(result.error)) {
        return null;
      }
      throw result.error;
    }

    if (!result.data) {
      await ensureForecastFresh({
        reason: params.reason || resolveForecastReason(monthStartIso),
        referenceDate,
        force: true,
        moneyViewScope,
      }).catch(() => null);

      result = await fetchLatest();
      if (result.error) {
        if (isMissingRelationError(result.error)) {
          return null;
        }
        throw result.error;
      }

      if (!result.data) {
        return null;
      }
    }

    let row = result.data as Record<string, unknown>;
    let scopedLatestKnownBalance: Awaited<
      ReturnType<typeof loadLatestKnownBalanceSnapshot>
    > | null = null;

    // Current-month forecasts should follow the latest known operational anchor.
    // If that anchor moved, force a recompute so the canonical low point is
    // rebuilt from the same forecast eventset as the headline.
    if (isCurrentMonth(monthStartIso, referenceDate)) {
      scopedLatestKnownBalance = await loadLatestKnownBalanceSnapshot(
        resolvedUserId,
        moneyViewScope,
      ).catch(() => null);
      const storedAnchor =
        row.current_balance_anchor == null ? null : Number(row.current_balance_anchor);
      const latestAnchor = scopedLatestKnownBalance?.balance ?? null;
      const shouldRefreshForAnchor =
        latestAnchor != null &&
        (storedAnchor == null || Math.abs(storedAnchor - latestAnchor) > 0.01);

      if (shouldRefreshForAnchor) {
        await ensureForecastFresh({
          reason: params.reason || resolveForecastReason(monthStartIso),
          referenceDate,
          force: true,
          moneyViewScope,
        }).catch(() => null);

        result = await fetchLatest();
        if (result.error) {
          if (isMissingRelationError(result.error)) {
            return null;
          }
          throw result.error;
        }

        if (!result.data) {
          return null;
        }

        row = result.data as Record<string, unknown>;
      }
    }

    const legacySummary: InsightsForecastSummary = {
      monthStart: String(row.month_start || monthStartIso),
      forecastReferenceDate: row.forecast_reference_date
        ? String(row.forecast_reference_date)
        : null,
      scopeView: row.scope_view
        ? normalizeMoneyViewScope(row.scope_view, moneyViewScope)
        : moneyViewScope,
      currentBalanceAnchor:
        row.current_balance_anchor == null
          ? null
          : Number(row.current_balance_anchor),
      currentBalanceAnchorDate: row.current_balance_anchor_date
        ? String(row.current_balance_anchor_date)
        : null,
      cashRiskFlag:
        row.cash_risk_flag === "cash_gap_warning" ? "cash_gap_warning" : "none",
      riskFlag: row.risk_flag === "deficit_warning" ? "deficit_warning" : "none",
      expectedEndBalance:
        row.expected_end_of_month_balance == null
          ? null
          : Number(row.expected_end_of_month_balance),
      lowestExpectedBalance:
        row.lowest_expected_balance == null
          ? null
          : Number(row.lowest_expected_balance),
      lowestExpectedBalanceDate: row.lowest_expected_balance_date
        ? String(row.lowest_expected_balance_date)
        : null,
      nextExpectedEventDate: row.next_expected_event_date
        ? String(row.next_expected_event_date)
        : null,
      nextExpectedEventLabel: row.next_expected_event_label
        ? String(row.next_expected_event_label)
        : null,
      expectedIncomeTotal:
        row.expected_income_total == null
          ? null
          : Number(row.expected_income_total),
      remainingExpectedIncomeTotal:
        row.remaining_expected_income_total == null
          ? null
          : Number(row.remaining_expected_income_total),
      remainingExpectedExpenseTotal:
        row.remaining_expected_expense_total == null
          ? null
          : Number(row.remaining_expected_expense_total),
      remainingExpectedSavingsOutflowTotal:
        row.remaining_expected_savings_outflow_total == null
          ? null
          : Number(row.remaining_expected_savings_outflow_total),
      upcomingCommittedIncomeTotal:
        row.upcoming_committed_income_total == null
          ? null
          : Number(row.upcoming_committed_income_total),
      upcomingCommittedExpenseTotal:
        row.upcoming_committed_expense_total == null
          ? null
          : Number(row.upcoming_committed_expense_total),
      expectedFixedCosts:
        row.expected_fixed_costs == null
          ? null
          : Number(row.expected_fixed_costs),
      expectedSubscriptions:
        row.expected_subscriptions == null
          ? null
          : Number(row.expected_subscriptions),
      expectedVariableCosts:
        row.expected_variable_costs == null
          ? null
          : Number(row.expected_variable_costs),
      // Exposed for surface compatibility only.
      // Do not treat as a canonical replacement for avgLast3Months in assistant advice.
      avgGroceries:
        row.avg_groceries == null ? null : Number(row.avg_groceries),
      avgFuel:
        row.avg_fuel == null ? null : Number(row.avg_fuel),
      avgSmoking:
        row.avg_smoking == null ? null : Number(row.avg_smoking),
      avgOtherVariable:
        row.avg_other_variable == null
          ? null
          : Number(row.avg_other_variable),
      topCostBuckets: [
        row.top_cost_bucket_1,
        row.top_cost_bucket_2,
        row.top_cost_bucket_3,
      ]
        .map((entry) => (entry == null ? "" : String(entry).trim()))
        .filter(Boolean),
    };

    const monthState = buildForecastMonthStateFromLegacySummary(
      legacySummary,
      null,
      scopedLatestKnownBalance,
    );
    // TODO: fase B vervangt deze roundtrip door een echte domeinbron.
    return adaptForecastMonthStateToLegacySummary(monthState);
  } catch (error) {
    console.error("[forecast-summary] load error", error);
    return null;
  }
}
