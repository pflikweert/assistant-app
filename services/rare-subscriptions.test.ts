import { describe, expect, it } from "vitest";

import type { CategoryRecord } from "@/types/categorization";

import { detectRareSubscriptionItems } from "./rare-subscriptions";

const categories: CategoryRecord[] = [
  {
    id: "cat-subscriptions",
    key: "subscriptions_streaming",
    name: "Streaming",
    parent_id: null,
    budget_group: "fixed",
    sort_order: 10,
  },
];

describe("detectRareSubscriptionItems", () => {
  it("detects yearly and half-yearly subscription charges while ignoring monthly ones", () => {
    const items = detectRareSubscriptionItems({
      referenceDate: "2026-03-16",
      categories,
      transactions: [
        {
          id: "adobe-2024",
          date: "2024-05-10",
          details: "Adobe Creative Cloud",
          counterparty: "Adobe",
          amount: -59.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "adobe-2025",
          date: "2025-05-11",
          details: "Adobe Creative Cloud",
          counterparty: "Adobe",
          amount: -64.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "norton-2025a",
          date: "2025-02-03",
          details: "Norton 360",
          counterparty: "Norton",
          amount: -34.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "norton-2025b",
          date: "2025-08-05",
          details: "Norton 360",
          counterparty: "Norton",
          amount: -34.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "spotify-jan",
          date: "2026-01-02",
          details: "Spotify",
          counterparty: "Spotify",
          amount: -10.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "spotify-feb",
          date: "2026-02-02",
          details: "Spotify",
          counterparty: "Spotify",
          amount: -10.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "spotify-mar",
          date: "2026-03-02",
          details: "Spotify",
          counterparty: "Spotify",
          amount: -10.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(
      items.map((item) => item.label).sort((left, right) => left.localeCompare(right)),
    ).toEqual(["Adobe", "Norton"]);

    const byLabel = new Map(items.map((item) => [item.label, item]));

    expect(byLabel.get("Adobe")).toMatchObject({
      cadence: "yearly",
      evidence: "confirmed",
      frequencyLabel: "1x per jaar",
      nextExpectedDate: "2026-05-11",
    });
    expect(byLabel.get("Norton")).toMatchObject({
      cadence: "semiannual",
      evidence: "confirmed",
      frequencyLabel: "2x per jaar",
    });
  });

  it("surfaces a single subscription-classified charge as a possible hidden payment", () => {
    const items = detectRareSubscriptionItems({
      referenceDate: "2026-03-16",
      categories,
      transactions: [
        {
          id: "domain-2025",
          date: "2025-11-20",
          details: "Mijn hostingpakket",
          counterparty: "TransIP",
          amount: -24.99,
          category_id_auto: "cat-subscriptions",
          category_id_user: null,
          analysis_category: "subscriptions",
        },
        {
          id: "keyword-only",
          date: "2025-12-01",
          details: "Hosting actie",
          counterparty: "Unknown PSP",
          amount: -19.99,
          category_id_auto: null,
          category_id_user: null,
          analysis_category: null,
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: "TransIP",
      cadence: "single",
      evidence: "possible",
      frequencyLabel: "1x gezien",
      nextExpectedDate: null,
    });
  });
});
