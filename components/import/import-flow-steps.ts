import type { FinanceStepIndicatorStep } from "@/components/ui/finance-step-indicator";

export const IMPORT_FLOW_STEPS: FinanceStepIndicatorStep[] = [
  { key: "choose-file", label: "Bestand kiezen" },
  { key: "link-accounts", label: "Rekeningen koppelen" },
  { key: "import-transactions", label: "Transacties inlezen" },
  { key: "finish", label: "Afronden" },
];
