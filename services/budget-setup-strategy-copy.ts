import type { AppIconName } from "@/components/ui/app-icon";
import type { BudgetSetupStrategy } from "@/services/budget-setup-proposal-schema";

export type BudgetSetupStrategyCopy = {
  label: string;
  shortLabel: string;
  description: string;
  shortDescription: string;
  iconName: AppIconName;
};

export const BUDGET_SETUP_STRATEGY_COPY: Record<BudgetSetupStrategy, BudgetSetupStrategyCopy> = {
  standaard: {
    label: "Normaal",
    shortLabel: "Normaal",
    description: "Voor een gewone maand. Een rustige verdeling die past bij je normale uitgaven.",
    shortDescription: "Gewone maand, rustige verdeling",
    iconName: "trending-flat",
  },
  balans: {
    label: "Balans",
    shortLabel: "Balans",
    description: "Voor meer grip en wat extra zekerheid. We beschermen iets meer voordat we je budget verdelen.",
    shortDescription: "Meer grip en extra bescherming",
    iconName: "balance",
  },
  bespaarmodus: {
    label: "Bespaarmodus",
    shortLabel: "Bespaarmodus",
    description: "Voor als je deze maand scherper moet sturen. We zetten je budgetten strakker zodat je meer overhoudt.",
    shortDescription: "Strakker budget, meer overhouden",
    iconName: "savings",
  },
  handmatig: {
    label: "Handmatig",
    shortLabel: "Handmatig",
    description: "Voor als je liever zelf kiest. Je stelt alles zelf in, met volledige controle.",
    shortDescription: "Zelf alles instellen",
    iconName: "edit",
  },
};

export const BUDGET_SETUP_SMART_STRATEGIES: BudgetSetupStrategy[] = [
  "standaard",
  "balans",
  "bespaarmodus",
];

export const BUDGET_SETUP_ALL_STRATEGIES: BudgetSetupStrategy[] = [
  "standaard",
  "balans",
  "bespaarmodus",
  "handmatig",
];

export const BUDGET_SETUP_DEFAULT_SMART_STRATEGY: BudgetSetupStrategy = "balans";

export function getBudgetSetupStrategyCopy(strategy: BudgetSetupStrategy) {
  return BUDGET_SETUP_STRATEGY_COPY[strategy];
}

export function getBudgetSetupStrategyLabel(strategy: BudgetSetupStrategy) {
  return BUDGET_SETUP_STRATEGY_COPY[strategy].label;
}

export function getBudgetSetupStrategyShortLabel(strategy: BudgetSetupStrategy) {
  return BUDGET_SETUP_STRATEGY_COPY[strategy].shortLabel;
}

export function getBudgetSetupStrategyDescription(strategy: BudgetSetupStrategy) {
  return BUDGET_SETUP_STRATEGY_COPY[strategy].description;
}

export function getBudgetSetupStrategyShortDescription(strategy: BudgetSetupStrategy) {
  return BUDGET_SETUP_STRATEGY_COPY[strategy].shortDescription;
}
