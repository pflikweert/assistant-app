import { getDefaultAiModel } from "@/services/ai-model-catalog";
import { postOpenAIChatCompletion } from "@/services/openai-proxy";
import {
  buildBudgetSetupFallbackProposal,
  getBudgetSetupToolContext,
  type BudgetSetupToolContextInput,
} from "./budget-setup-tools";
import {
  buildBudgetSetupProposalJsonSchema,
  validateBudgetSetupProposal,
  type BudgetSetupProposal,
  type BudgetSetupStrategy,
} from "./budget-setup-proposal-schema";

const DEFAULT_MODEL = getDefaultAiModel();

function parseJsonObject(content: string) {
  const trimmed = String(content || "").trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) candidates.push(fence[1].trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export type BuildBudgetSetupProposalInput = BudgetSetupToolContextInput & {
  selectedMode?: BudgetSetupStrategy;
  userPrompt?: string | null;
  model?: string;
};

function buildBudgetSetupSystemPrompt() {
  return [
    "Je bent de Budget Setup Orchestrator van Budio.",
    "Je maakt een veilig en uitlegbaar maandvoorstel.",
    "Gebruik uitsluitend aangeleverde contextdata als bron voor bedragen en context.",
    "Harde data gaat voor afgeleide data, forecast en AI-uitleg.",
    "Introduceer nooit nieuwe financiële waarheid buiten de tooldata.",
    "Gebruik strategieen: standaard, balans, bespaarmodus, handmatig.",
    "In handmatig-modus: geen autonoom allocatiebesluit zonder expliciete vraag.",
    "Geef geen hypecopy of chat-achtige output.",
    "Werk rustig, compact en controleerbaar.",
  ].join(" ");
}

function buildBudgetSetupUserPrompt(input: {
  selectedMode?: BudgetSetupStrategy;
  userPrompt?: string | null;
}) {
  const requestedMode = input.selectedMode || "standaard";
  const userPrompt = String(input.userPrompt || "").trim();
  return [
    `Gevraagde strategie: ${requestedMode}.`,
    "Maak eerst een voorstel op basis van context, daarna pas nuances.",
    "Toon beschermde bedragen, variabele pool en categorieverdeling.",
    userPrompt ? `Extra gebruikerscontext: ${userPrompt}` : null,
    "Werk met compacte context en maak geen nieuwe financiële waarheid.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFinalProposalPrompt() {
  return [
    "Lever nu uitsluitend het voorstelobject in strict JSON.",
    "Het object moet volledig voldoen aan het schema budget_setup_proposal_v1.",
    "Zorg dat monthlyVariableBudgets optelt tot variableBudgetPool.",
    "Gebruik korte rationale en korte userSummary in het Nederlands.",
  ].join(" ");
}

export async function buildBudgetSetupProposal(
  input: BuildBudgetSetupProposalInput,
): Promise<BudgetSetupProposal> {
  const model = input.model || DEFAULT_MODEL;
  const context = await getBudgetSetupToolContext({
    referenceDate: input.referenceDate,
    monthStartIso: input.monthStartIso,
    planKey: input.planKey,
    moneyViewScope: input.moneyViewScope,
    userId: input.userId,
  });

  const messages: Record<string, unknown>[] = [
    {
      role: "system",
      content: buildBudgetSetupSystemPrompt(),
    },
    {
      role: "user",
      content: buildBudgetSetupUserPrompt({
        selectedMode: input.selectedMode,
        userPrompt: input.userPrompt,
      }),
    },
    {
      role: "user",
      content: JSON.stringify({
        monthStartIso: input.monthStartIso,
        baseContext: context.base,
      }),
    },
  ];

  try {
    const finalResponse = await postOpenAIChatCompletion(
      {
        model,
        temperature: 0.1,
        max_tokens: 1400,
        response_format: {
          type: "json_schema",
          json_schema: buildBudgetSetupProposalJsonSchema(),
        },
        messages: [
          ...messages,
          {
            role: "system",
            content: buildFinalProposalPrompt(),
          },
        ],
      },
      {
        useCase: "budget_coach",
        agentMode: "analysis",
        responseMode: "json_schema",
        fallbackEnabled: true,
      },
    );
    if (!finalResponse.ok) {
      throw new Error(`Budget setup final call failed (${finalResponse.status})`);
    }
    const finalData = (await finalResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = String(finalData.choices?.[0]?.message?.content || "").trim();
    const parsed = parseJsonObject(content) || content;
    const validation = validateBudgetSetupProposal(parsed);
    if (validation.ok && validation.normalized) return validation.normalized;
  } catch (error) {
    console.warn("[budget-setup] proposal generation failed, using fallback", error);
  }

  return buildBudgetSetupFallbackProposal({
    context,
    selectedMode: input.selectedMode || "standaard",
  });
}
