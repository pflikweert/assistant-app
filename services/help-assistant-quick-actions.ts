import type { HelpAssistantContext } from "@/services/help-assistant-context";

export type HelpAssistantQuickActionId =
  | "explain_screen"
  | "report_bug"
  | "share_idea"
  | "can_i_still_spend"
  | "how_much_space_left";

export type HelpAssistantQuickActionBehavior =
  | "prefill_composer"
  | "start_local_thread";

export type HelpAssistantQuickActionIntent =
  | "screen_explanation"
  | "discrepancy_check"
  | "bug_report"
  | "feature_idea"
  | "spending_check"
  | "remaining_space";

export type HelpAssistantQuickActionTarget =
  | "general_help"
  | "issue_draft"
  | "spending_advice";

export type HelpAssistantQuickAction = {
  id: HelpAssistantQuickActionId;
  label: string;
  description: string;
  behavior: HelpAssistantQuickActionBehavior;
  intent: HelpAssistantQuickActionIntent;
  target: HelpAssistantQuickActionTarget;
  seedText: string;
};

function getPeriodLabel(context: HelpAssistantContext) {
  return context.selectedPeriod?.label || "deze periode";
}

function buildBaseQuickActions(
  context: HelpAssistantContext,
): HelpAssistantQuickAction[] {
  const periodLabel = getPeriodLabel(context);

  return [
    {
      id: "explain_screen",
      label: "Leg dit scherm uit",
      description: `Korte uitleg voor ${context.screenTitle.toLowerCase()}.`,
      behavior: "start_local_thread",
      intent: "screen_explanation",
      target: "general_help",
      seedText: `Leg uit wat ik op ${context.screenTitle} zie en waar ik als eerste op moet letten.`,
    },
    {
      id: "report_bug",
      label: "Probleem melden",
      description: "Start een gesprek over een probleem of bug.",
      behavior: "start_local_thread",
      intent: "bug_report",
      target: "issue_draft",
      seedText: `Ik wil een probleem melden op ${context.screenTitle}.`,
    },
    {
      id: "share_idea",
      label: "Idee melden",
      description: "Start een gesprek over een idee of verbetering.",
      behavior: "start_local_thread",
      intent: "feature_idea",
      target: "issue_draft",
      seedText: `Ik wil een idee melden voor ${context.screenTitle}.`,
    },
    {
      id: "can_i_still_spend",
      label: "Kan ik dit nog uitgeven?",
      description: `Snelle check voor ${periodLabel}.`,
      behavior: "prefill_composer",
      intent: "spending_check",
      target: "spending_advice",
      seedText: `Kan ik dit nog uitgeven in ${periodLabel}?`,
    },
    {
      id: "how_much_space_left",
      label: "Hoeveel ruimte heb ik nog deze maand?",
      description: `Vraag naar resterende ruimte in ${periodLabel}.`,
      behavior: "prefill_composer",
      intent: "remaining_space",
      target: "spending_advice",
      seedText: `Hoeveel ruimte heb ik nog in ${periodLabel}?`,
    },
  ];
}

export function listHelpAssistantQuickActions(
  context: HelpAssistantContext,
): HelpAssistantQuickAction[] {
  const actions = buildBaseQuickActions(context);
  const issueActions = [actions[1], actions[2]];
  const generalActions = [actions[0]];
  const spendingActions = [actions[3], actions[4]];

  if (context.screenId === "budget" || context.screenId === "insights") {
    return [
      spendingActions[0],
      spendingActions[1],
      issueActions[0],
      issueActions[1],
      generalActions[0],
    ];
  }

  return [
    issueActions[0],
    issueActions[1],
    generalActions[0],
    spendingActions[0],
    spendingActions[1],
  ];
}
