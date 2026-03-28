import { buildConfidenceLayerMetadata } from "@/services/explain-logic";
import { describe, expect, it } from "vitest";

describe("buildConfidenceLayerMetadata", () => {
  it("mapt confidence levels naar scorelabels en delta-reason", () => {
    const layer = buildConfidenceLayerMetadata({
      freeToSpendNowSignal: {
        level: "high",
        label: "Hoog vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      safeToSpendSignal: {
        level: "medium",
        label: "Redelijk vertrouwen",
        provenance: "derived",
        reasons: [],
      },
      freeToSpendExplanationString: "Vrij besteedbaar nu is operationeel minus gereserveerd.",
      safeToSpendExplanationString:
        "We rekenen tot je salaris op 24 april, rekening houdend met €950 aan verwachte lasten.",
      safeToSpendDeltaReasonLabel: "Komende huurbetaling",
      safeToSpendDeltaReasonAmount: 736.58,
    });

    expect(layer.freeToSpendNow.score).toBe("HIGH");
    expect(layer.safeToSpendUntilNextIncome.score).toBe("MEDIUM");
    expect(layer.safeToSpendUntilNextIncome.deltaReason?.label).toBe(
      "Komende huurbetaling",
    );
  });
});
