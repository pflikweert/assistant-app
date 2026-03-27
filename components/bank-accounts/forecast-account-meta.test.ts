import { describe, expect, it } from "vitest";

import { buildForecastAccountMetaItems } from "./forecast-account-meta";

describe("buildForecastAccountMetaItems", () => {
  it("toont veilige standaardlabels voor een normale rekening", () => {
    const items = buildForecastAccountMetaItems({
      account_type: "checking",
      is_active: true,
      name: "Betaalrekening",
      provider: "ING",
    });

    expect(items.map((item) => item.label)).toEqual([
      "Rol",
      "Geldcontext",
      "Budget",
      "Cashflow",
      "Vermogen",
    ]);
    expect(items.find((item) => item.label === "Rol")?.value).toBe("Operationeel");
    expect(items.find((item) => item.label === "Geldcontext")?.value).toBe("Persoonlijk");
    expect(items.find((item) => item.label === "Budget")?.value).toBe("Telt mee");
    expect(items.find((item) => item.label === "Cashflow")?.value).toBe("Telt mee");
    expect(items.find((item) => item.label === "Vermogen")?.value).toBe("Telt mee");
  });

  it("laat een gedeelde, gearchiveerde rekening compact zien", () => {
    const items = buildForecastAccountMetaItems({
      account_type: "savings",
      forecast_role: undefined,
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: true,
      is_active: false,
      name: "Gezamenlijke spaarrekening",
      owner_scope: "shared",
      provider: "Rabobank",
    });

    expect(items.find((item) => item.label === "Rol")?.value).toBe("Alleen bekijken");
    expect(items.find((item) => item.label === "Geldcontext")?.value).toBe("Gedeeld");
    expect(items.find((item) => item.label === "Budget")?.value).toBe("Niet mee");
    expect(items.find((item) => item.label === "Cashflow")?.value).toBe("Niet mee");
    expect(items.find((item) => item.label === "Vermogen")?.value).toBe("Telt mee");
  });
});
