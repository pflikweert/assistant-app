import { requireCurrentUserId } from "@/services/current-user";
import { markForecastDirty } from "@/services/forecast-refresh";
import {
  resetMonthlyBudgetValues,
  upsertBudgetPlanSettings,
  upsertMonthlyBudgetValue,
} from "@/services/budget-plan-repository";
import type { BudgetPlanMode } from "@/types/categorization";
import {
  validateBudgetSetupProposal,
  type BudgetSetupProposal,
  type BudgetSetupStrategy,
} from "./budget-setup-proposal-schema";

export type BudgetSetupApplyResult = {
  applied: boolean;
  proposalId: string;
  monthStartIso: string;
  planKey: string;
  idempotentReplay: boolean;
  summary: {
    selectedMode: BudgetSetupStrategy;
    configuredVariableBudgetTotal: number;
    configuredSavingsTargetMonthly: number | null;
    configuredCategoryCount: number;
  };
};

export type ApplyBudgetSetupProposalInput = {
  proposal: BudgetSetupProposal | string;
  monthStartIso: string;
  planKey?: string;
  idempotencyKey?: string | null;
};

type BudgetSetupApplyDeps = {
  requireCurrentUserId: typeof requireCurrentUserId;
  upsertBudgetPlanSettings: typeof upsertBudgetPlanSettings;
  resetMonthlyBudgetValues: typeof resetMonthlyBudgetValues;
  upsertMonthlyBudgetValue: typeof upsertMonthlyBudgetValue;
  markForecastDirty: typeof markForecastDirty;
};

const defaultDeps: BudgetSetupApplyDeps = {
  requireCurrentUserId,
  upsertBudgetPlanSettings,
  resetMonthlyBudgetValues,
  upsertMonthlyBudgetValue,
  markForecastDirty,
};

const applyReplayCache = new Map<string, BudgetSetupApplyResult>();

function normalizeMonthStartIso(value: string) {
  const trimmed = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid monthStartIso: ${value}`);
  }
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function mapStrategyToBudgetPlanMode(strategy: BudgetSetupStrategy): BudgetPlanMode {
  if (strategy === "bespaarmodus") return "active_savings";
  if (strategy === "handmatig") return "custom";
  return "balanced";
}

function resolveModeSettings(strategy: BudgetSetupStrategy) {
  if (strategy === "bespaarmodus") {
    return {
      mode: "active_savings" as const,
      applySavingsTargetToVariableBudget: true,
    };
  }
  if (strategy === "balans") {
    return {
      mode: "balanced" as const,
      applySavingsTargetToVariableBudget: true,
    };
  }
  if (strategy === "handmatig") {
    return {
      mode: "custom" as const,
      applySavingsTargetToVariableBudget: false,
    };
  }
  return {
    mode: "balanced" as const,
    applySavingsTargetToVariableBudget: false,
  };
}

function asPayloadHash(input: {
  proposalId: string;
  planKey: string;
  monthStartIso: string;
  userId: string;
  idempotencyKey?: string | null;
  proposal: BudgetSetupProposal;
}) {
  const stable = JSON.stringify({
    proposalId: input.proposalId,
    planKey: input.planKey,
    monthStartIso: input.monthStartIso,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey || null,
    mode: input.proposal.selectedMode,
    variableBudgetPool: input.proposal.variableBudgetPool,
    monthlyVariableBudgets: input.proposal.applyPayload.monthlyVariableBudgets,
    savingsTargetMonthly: input.proposal.applyPayload.planSettings.savingsTargetMonthly,
    includeIncome: input.proposal.applyPayload.planSettings.includeIncome,
  });
  return stable;
}

export async function applyBudgetSetupProposal(
  input: ApplyBudgetSetupProposalInput,
  deps: BudgetSetupApplyDeps = defaultDeps,
): Promise<BudgetSetupApplyResult> {
  const validation = validateBudgetSetupProposal(input.proposal);
  if (!validation.ok || !validation.normalized) {
    throw new Error(
      `Budget setup voorstel ongeldig: ${validation.issues.join(" | ")}`,
    );
  }

  const proposal = validation.normalized;
  const monthStartIso = normalizeMonthStartIso(input.monthStartIso);
  const planKey = String(input.planKey || "default").trim() || "default";
  const userId = await deps.requireCurrentUserId();
  const payloadHash = asPayloadHash({
    proposalId: proposal.proposalId,
    planKey,
    monthStartIso,
    userId,
    idempotencyKey: input.idempotencyKey,
    proposal,
  });

  const cached = applyReplayCache.get(payloadHash);
  if (cached) {
    return {
      ...cached,
      idempotentReplay: true,
    };
  }

  const modeSettings = resolveModeSettings(proposal.applyPayload.planSettings.strategy);
  const mappedMode = mapStrategyToBudgetPlanMode(
    proposal.applyPayload.planSettings.strategy,
  );
  await deps.upsertBudgetPlanSettings({
    planKey,
    mode: mappedMode,
    includeIncome: {
      ...proposal.applyPayload.planSettings.includeIncome,
    },
    applySavingsTargetToVariableBudget:
      proposal.applyPayload.planSettings.applySavingsTargetToVariableBudget ??
      modeSettings.applySavingsTargetToVariableBudget,
    savingsTargetMonthly:
      proposal.applyPayload.planSettings.savingsTargetMonthly ?? 0,
  });

  await deps.resetMonthlyBudgetValues({
    planKey,
    monthStartIso,
  });

  const monthlyBudgets = proposal.applyPayload.monthlyVariableBudgets;
  for (const row of monthlyBudgets) {
    await deps.upsertMonthlyBudgetValue({
      planKey,
      monthStartIso,
      categoryKey: row.categoryKey,
      monthlyBudget: row.amount,
      source: "manual",
    });
  }

  if (
    proposal.applyPayload.planSettings.savingsTargetMonthly != null &&
    proposal.applyPayload.planSettings.savingsTargetMonthly > 0
  ) {
    await deps.upsertMonthlyBudgetValue({
      planKey,
      monthStartIso,
      categoryKey: "savings_target",
      monthlyBudget: proposal.applyPayload.planSettings.savingsTargetMonthly,
      source: "manual",
    });
  }

  await deps.markForecastDirty("budget_save", { userId }).catch(() => null);

  const result: BudgetSetupApplyResult = {
    applied: true,
    proposalId: proposal.proposalId,
    monthStartIso,
    planKey,
    idempotentReplay: false,
    summary: {
      selectedMode: proposal.selectedMode,
      configuredVariableBudgetTotal: monthlyBudgets.reduce(
        (sum, row) => sum + Math.max(0, Math.round(row.amount)),
        0,
      ),
      configuredSavingsTargetMonthly:
        proposal.applyPayload.planSettings.savingsTargetMonthly,
      configuredCategoryCount: monthlyBudgets.filter((row) => row.amount > 0).length,
    },
  };
  applyReplayCache.set(payloadHash, result);
  return result;
}

export function __resetBudgetSetupApplyReplayCacheForTests() {
  applyReplayCache.clear();
}

