import { describe, expect, it } from "vitest";

import {
  getAuthRegistrationErrorMessage,
  getAuthSignInErrorMessage,
} from "./auth-error-messages";

describe("getAuthSignInErrorMessage", () => {
  it("vertaalt onjuiste login credentials", () => {
    expect(
      getAuthSignInErrorMessage(new Error("Invalid login credentials")),
    ).toBe("Onjuiste inloggegevens.");
  });

  it("valt terug op de fallback voor onbekende fouten", () => {
    expect(getAuthSignInErrorMessage(new Error("Something went wrong"))).toBe(
      "Inloggen mislukt.",
    );
  });
});

describe("getAuthRegistrationErrorMessage", () => {
  it("vertaalt een al geregistreerd e-mailadres", () => {
    expect(
      getAuthRegistrationErrorMessage(new Error("Email already registered")),
    ).toBe("Dit e-mailadres is al in gebruik.");
  });

  it("vertaalt een ongeldig e-mailadres", () => {
    expect(getAuthRegistrationErrorMessage(new Error("Invalid email"))).toBe(
      "Voer een geldig e-mailadres in.",
    );
  });
});
