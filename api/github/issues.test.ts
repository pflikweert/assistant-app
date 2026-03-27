import { describe, expect, it } from "vitest";

import {
  buildGithubIssuePayload,
  deriveGithubOwner,
  normalizeGithubRepoName,
  sanitizeLabel,
  sanitizeText,
} from "./issues.ts";

describe("github issue payload helpers", () => {
  it("redacts sensitive data and normalizes labels", () => {
    expect(
      sanitizeText(
        "Contact: test@example.com, IBAN NL91ABNA0417164300, url https://example.com/with?x=1",
        200,
      ),
    ).toContain("[redacted-email]");
    expect(
      sanitizeText(
        "Contact: test@example.com, IBAN NL91ABNA0417164300, url https://example.com/with?x=1",
        200,
      ),
    ).toContain("[redacted-iban]");
    expect(sanitizeLabel("Source:Help Assistant")).toBe("source:help-assistant");
    expect(sanitizeLabel("screen:Inzichten")).toBe("screen:inzichten");
  });

  it("builds a github payload with sanitized public content", () => {
    const payload = buildGithubIssuePayload({
      sourceMessageId: "msg-1",
      type: "feature_request",
      summary: "Ik wil een grafiek zien",
      context: {
        screenTitle: "Inzichten",
        routeName: "/insights?email=test@example.com",
        periodLabel: "maart 2026",
        platform: "web",
      },
      labels: [
        "Source:Help Assistant",
        "screen:Inzichten",
        "screen:Inzichten",
        "type:feature request",
      ],
      shortDescription:
        "Gebruikersmelding op Inzichten: test@example.com wil dit zien.",
    } as Parameters<typeof buildGithubIssuePayload>[0], {
      userId: "user-123",
      displayName: "Pieter Flikweert",
    });

    expect(payload.title).toBe("Ik wil een grafiek zien");
    expect(payload.labels).toContain("source:help-assistant");
    expect(payload.labels).toContain("screen:inzichten");
    expect(payload.body).toContain("[redacted-email]");
    expect(payload.body).not.toContain("test@example.com");
    expect(payload.body).toContain("## Help Assistant issue draft");
    expect(payload.body).toContain("Naam melder: Pieter Flikweert");
    expect(payload.body).toContain("Gebruikers-ID: user-123");
    expect(payload.body).toContain("Bron: Help Assistant chat");
  });

  it("normalizes full owner/repo config values", () => {
    expect(normalizeGithubRepoName("pflikweert/assistant-app")).toBe(
      "assistant-app",
    );
    expect(normalizeGithubRepoName("assistant-app")).toBe("assistant-app");
    expect(deriveGithubOwner("pflikweert/assistant-app", "fallback-owner")).toBe(
      "pflikweert",
    );
    expect(deriveGithubOwner("assistant-app", "fallback-owner")).toBe(
      "fallback-owner",
    );
  });
});
