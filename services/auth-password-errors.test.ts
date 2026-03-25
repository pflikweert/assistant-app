import { describe, expect, it } from "vitest";

import { getPasswordUpdateErrorMessage } from "./auth-password-errors";

describe("getPasswordUpdateErrorMessage", () => {
  it("vertaalt dezelfde-wachtwoord-fout naar Nederlands", () => {
    expect(
      getPasswordUpdateErrorMessage(
        new Error("New password should be different from the old password."),
      ),
    ).toBe("Kies een ander wachtwoord dan je huidige wachtwoord.");
  });

  it("valt terug op de fallback voor onbekende fouten", () => {
    expect(
      getPasswordUpdateErrorMessage(new Error("Something went wrong"), "Fallback"),
    ).toBe("Fallback");
  });
});
