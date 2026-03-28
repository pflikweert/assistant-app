import type { ConfidenceLevel, ConfidenceSignal } from "@/services/confidence-model";

export type ConfidenceScore = "HIGH" | "MEDIUM" | "INDICATIVE";

export type DeltaReason = {
  label: string | null;
  amount: number | null;
  message: string | null;
};

export type ConfidenceLayerEntry = {
  score: ConfidenceScore;
  scoreLabel: "Veilig" | "Redelijk" | "Verwacht";
  explanationString: string | null;
  deltaReason?: DeltaReason | null;
};

export type ConfidenceLayerMetadata = {
  freeToSpendNow: ConfidenceLayerEntry;
  safeToSpendUntilNextIncome: ConfidenceLayerEntry;
};

function toScore(level: ConfidenceLevel | null | undefined): ConfidenceScore {
  if (level === "high") return "HIGH";
  if (level === "medium") return "MEDIUM";
  return "INDICATIVE";
}

function toScoreLabel(score: ConfidenceScore): ConfidenceLayerEntry["scoreLabel"] {
  if (score === "HIGH") return "Veilig";
  if (score === "MEDIUM") return "Redelijk";
  return "Verwacht";
}

export function buildConfidenceLayerMetadata(input: {
  freeToSpendNowSignal: ConfidenceSignal | null;
  safeToSpendSignal: ConfidenceSignal | null;
  freeToSpendExplanationString: string | null;
  safeToSpendExplanationString: string | null;
  safeToSpendDeltaReasonLabel: string | null;
  safeToSpendDeltaReasonAmount: number | null;
}): ConfidenceLayerMetadata {
  const freeScore = toScore(input.freeToSpendNowSignal?.level);
  const safeScore = toScore(input.safeToSpendSignal?.level);

  return {
    freeToSpendNow: {
      score: freeScore,
      scoreLabel: toScoreLabel(freeScore),
      explanationString: input.freeToSpendExplanationString,
    },
    safeToSpendUntilNextIncome: {
      score: safeScore,
      scoreLabel: toScoreLabel(safeScore),
      explanationString: input.safeToSpendExplanationString,
      deltaReason:
        input.safeToSpendDeltaReasonLabel == null
          ? null
          : {
              label: input.safeToSpendDeltaReasonLabel,
              amount: input.safeToSpendDeltaReasonAmount,
              message:
                input.safeToSpendDeltaReasonAmount == null
                  ? `Belangrijkste oorzaak: ${input.safeToSpendDeltaReasonLabel}.`
                  : `Belangrijkste oorzaak: ${input.safeToSpendDeltaReasonLabel} (${new Intl.NumberFormat(
                      "nl-NL",
                      {
                        style: "currency",
                        currency: "EUR",
                      },
                    ).format(input.safeToSpendDeltaReasonAmount)}).`,
            },
    },
  };
}
