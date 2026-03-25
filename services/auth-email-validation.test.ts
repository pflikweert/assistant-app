import { describe, expect, it } from "vitest";

import { getEmailFeedback } from "./auth-email-validation";

describe("getEmailFeedback", () => {
  it("vraagt om een e-mailadres wanneer het veld leeg is", () => {
    expect(getEmailFeedback("")).toEqual({
      emailValid: false,
      emailHint: "Vul je e-mailadres in.",
    });
  });

  it("vraagt om een geldig e-mailadres bij een onjuist formaat", () => {
    expect(getEmailFeedback("naam@voorbeeld")).toEqual({
      emailValid: false,
      emailHint: "Voer een geldig e-mailadres in.",
    });
  });

  it("accepteert een geldig e-mailadres", () => {
    expect(getEmailFeedback("naam@voorbeeld.nl")).toEqual({
      emailValid: true,
      emailHint: null,
    });
  });
});
