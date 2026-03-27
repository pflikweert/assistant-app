import {
  FORECAST_EVENT_TYPES,
  FORECAST_TIMELINE_STORAGE_EVENT_TYPES,
  normalizeForecastCertainty,
  normalizeForecastEventType,
} from "@/services/forecast-domain";
import { describe, expect, it } from "vitest";

describe("forecast domain", () => {
  it("houdt de centrale eventtypes compact en nieuw", () => {
    expect(FORECAST_EVENT_TYPES).toEqual([
      "income",
      "expense",
      "internal_transfer",
      "reserve_allocation",
      "correction",
    ]);
    expect(FORECAST_TIMELINE_STORAGE_EVENT_TYPES).toContain(
      "milestone_lowest_balance",
    );
  });

  it("normaliseert onbekende eventtypes veilig naar correction", () => {
    expect(normalizeForecastEventType("unknown")).toBe("correction");
    expect(normalizeForecastEventType("income")).toBe("income");
  });

  it("blijft legacy certainty labels accepteren", () => {
    expect(normalizeForecastCertainty("high")).toBe("booked");
    expect(normalizeForecastCertainty("medium")).toBe("committed");
    expect(normalizeForecastCertainty("low")).toBe("inferred");
  });
});
