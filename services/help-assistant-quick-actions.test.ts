import { describe, expect, it } from "vitest";

import { buildHelpAssistantContext } from "./help-assistant-context";
import { listHelpAssistantQuickActions } from "./help-assistant-quick-actions";

describe("help-assistant-quick-actions", () => {
  it("shows explicit issue chips in the default quick action list", () => {
    const context = buildHelpAssistantContext({
      screenId: "dashboard",
      routeName: "/dashboard",
      selectedPeriod: { label: "maart 2026" },
    });

    const actions = listHelpAssistantQuickActions(context);
    const labels = actions.map((action) => action.label);

    expect(labels).toContain("Probleem melden");
    expect(labels).toContain("Idee melden");
    expect(labels).not.toContain("Waarom klopt dit niet?");
  });

  it("prioritizes issue chips on the default screens before spending actions", () => {
    const context = buildHelpAssistantContext({
      screenId: "dashboard",
      routeName: "/dashboard",
      selectedPeriod: { label: "maart 2026" },
    });

    const actions = listHelpAssistantQuickActions(context);

    expect(actions[0]?.label).toBe("Probleem melden");
    expect(actions[1]?.label).toBe("Idee melden");
  });
});
