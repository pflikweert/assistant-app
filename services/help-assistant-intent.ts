import type { HelpAssistantQuickActionIntent } from "@/services/help-assistant-quick-actions";

export type HelpAssistantClassifiedIntent =
  | "uitlegvraag"
  | "probleemhulp"
  | "feedback"
  | "feature_request"
  | "mogelijke_bug"
  | "spending_advice";

export type HelpAssistantIntentConfidence = "low" | "medium" | "high";

export type HelpAssistantIntentClassification = {
  intent: HelpAssistantClassifiedIntent;
  confidence: HelpAssistantIntentConfidence;
  matchedSignals: string[];
  classifierVersion: "v1_heuristic";
};

type IntentRule = {
  intent: HelpAssistantClassifiedIntent;
  priority: number;
  strongPatterns: RegExp[];
  keywords: string[];
};

const RULES: IntentRule[] = [
  {
    intent: "mogelijke_bug",
    priority: 90,
    strongPatterns: [
      /\b(ik zie een fout|dit is een fout|lijkt een bug)\b/,
      /\b(error|crash|vastgelopen)\b/,
    ],
    keywords: ["bug", "fout", "error", "crash", "vastgelopen", "werkt niet"],
  },
  {
    intent: "feature_request",
    priority: 80,
    strongPatterns: [
      /\b(kunnen jullie|zou het kunnen)\b/,
      /\b(ik wil graag dat|ik zou graag)\b/,
      /\b(ik zou wel|ik wil wel|ik zou graag willen)\b/,
    ],
    keywords: [
      "feature",
      "toevoegen",
      "bouwen",
      "wens",
      "verzoek",
      "missen",
      "grafiek",
      "grafieken",
      "overzicht",
      "visualisatie",
      "weergave",
      "filter",
    ],
  },
  {
    intent: "feedback",
    priority: 70,
    strongPatterns: [/\b(ik heb een idee|mijn suggestie)\b/],
    keywords: ["feedback", "idee", "suggestie", "verbetering"],
  },
  {
    intent: "spending_advice",
    priority: 60,
    strongPatterns: [
      /\b(hoeveel ruimte heb ik nog)\b/,
      /\b(kan ik nog .{0,20} uitgeven)\b/,
    ],
    keywords: [
      "ruimte",
      "uitgeven",
      "bestedingsruimte",
      "budget",
      "kan ik nog",
      "deze maand",
    ],
  },
  {
    intent: "uitlegvraag",
    priority: 50,
    strongPatterns: [/\b(leg.*uit|wat betekent|hoe werkt)\b/],
    keywords: ["uitleg", "betekent", "waarom staat", "hoe zit dit"],
  },
  {
    intent: "probleemhulp",
    priority: 40,
    strongPatterns: [/\b(waarom klopt.*niet|klopt dit niet)\b/],
    keywords: [
      "help",
      "probleem",
      "klopt niet",
      "onjuist",
      "waarom",
      "kan niet",
    ],
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function classifyConfidence(strongMatches: number, keywordMatches: number) {
  if (strongMatches > 0 || keywordMatches >= 3) return "high" as const;
  if (keywordMatches >= 1) return "medium" as const;
  return "low" as const;
}

function scoreRule(input: string, rule: IntentRule) {
  const strongMatches = rule.strongPatterns.filter((pattern) =>
    pattern.test(input),
  );
  const keywordMatches = rule.keywords.filter((keyword) =>
    input.includes(keyword),
  );
  const score =
    rule.priority + strongMatches.length * 40 + keywordMatches.length * 10;

  return {
    score,
    strongMatches: strongMatches.length,
    keywordMatches: keywordMatches.length,
    hasMatch: strongMatches.length > 0 || keywordMatches.length > 0,
    matchedSignals: [
      ...strongMatches.map((pattern) => `pattern:${pattern.source}`),
      ...keywordMatches.map((keyword) => `keyword:${keyword}`),
    ],
  };
}

export function classifyHelpAssistantIntent(
  input: string,
): HelpAssistantIntentClassification {
  const normalized = normalizeText(input);
  if (!normalized) {
    return {
      intent: "uitlegvraag",
      confidence: "low",
      matchedSignals: ["fallback:empty_input"],
      classifierVersion: "v1_heuristic",
    };
  }

  let best:
    | {
        rule: IntentRule;
        score: number;
        strongMatches: number;
        keywordMatches: number;
        matchedSignals: string[];
      }
    | null = null;

  for (const rule of RULES) {
    const result = scoreRule(normalized, rule);
    if (!result.hasMatch) continue;
    if (!best || result.score > best.score) {
      best = { rule, ...result };
    }
  }

  if (!best) {
    return {
      intent: "probleemhulp",
      confidence: "low",
      matchedSignals: ["fallback:no_rule"],
      classifierVersion: "v1_heuristic",
    };
  }

  return {
    intent: best.rule.intent,
    confidence: classifyConfidence(best.strongMatches, best.keywordMatches),
    matchedSignals: best.matchedSignals,
    classifierVersion: "v1_heuristic",
  };
}

export function classifyIntentFromQuickAction(input: {
  quickActionIntent: HelpAssistantQuickActionIntent;
  quickActionId: string;
}): HelpAssistantIntentClassification {
  const intentMap: Record<string, HelpAssistantClassifiedIntent> = {
    screen_explanation: "uitlegvraag",
    discrepancy_check: "probleemhulp",
    bug_report: "mogelijke_bug",
    feature_idea: "feature_request",
    spending_check: "spending_advice",
    remaining_space: "spending_advice",
  };

  return {
    intent: intentMap[input.quickActionIntent] || "probleemhulp",
    confidence: "high",
    matchedSignals: [`quick_action:${input.quickActionId}`],
    classifierVersion: "v1_heuristic",
  };
}
