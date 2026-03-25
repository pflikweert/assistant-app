import { describe, expect, it } from "vitest";

import {
  getPasswordFeedback,
  getPasswordRequirementsText,
} from "./auth-password-validation";

describe("getPasswordRequirementsText", () => {
  it("beschrijft de standaard wachtwoordregels", () => {
    expect(getPasswordRequirementsText()).toBe(
      "Gebruik minimaal 8 tekens en minstens 1 letter en 1 cijfer.",
    );
  });
});

describe("getPasswordFeedback", () => {
  it("toont een subtiele hint voor een te kort wachtwoord", () => {
    const feedback = getPasswordFeedback("abc1", "");
    expect(feedback.passwordValid).toBe(false);
    expect(feedback.passwordHint).toMatch(/Nog 4 tekens nodig/i);
  });

  it("vraagt om een letter of cijfer als die ontbreken", () => {
    expect(getPasswordFeedback("12345678", "").passwordHint).toBe(
      "Voeg minstens 1 letter toe.",
    );
    expect(getPasswordFeedback("abcdefgH", "").passwordHint).toBe(
      "Voeg minstens 1 cijfer toe.",
    );
  });

  it("merkt niet-gelijk ingevoerde wachtwoorden op", () => {
    const feedback = getPasswordFeedback("abc12345", "abc12346");
    expect(feedback.passwordValid).toBe(true);
    expect(feedback.confirmValid).toBe(true);
    expect(feedback.passwordsMatch).toBe(false);
    expect(feedback.confirmHint).toBe("Wachtwoorden komen nog niet overeen.");
  });
});
