import { describe, expect, it } from "vitest";

import type { CategoryRecord } from "@/types/categorization";

import { resolveTransactionCategoryIconName } from "./category-icon";

function createCategoryMap(categories: CategoryRecord[]) {
  return new Map(categories.map((category) => [category.id, category]));
}

describe("resolveTransactionCategoryIconName", () => {
  it("uses the leaf transaction category for supermarket transactions", () => {
    const categoryById = createCategoryMap([
      {
        id: "groceries-root",
        key: "groceries_household",
        name: "Boodschappen & huishouden",
        parent_id: null,
        budget_group: "variable",
        sort_order: 50,
      },
      {
        id: "supermarket",
        key: "groceries_household_supermarket",
        name: "Supermarkt",
        parent_id: "groceries-root",
        budget_group: "variable",
        sort_order: 51,
      },
    ]);

    expect(
      resolveTransactionCategoryIconName(
        { category_id_auto: "supermarket", category_id_user: null },
        categoryById,
      ),
    ).toBe("shopping-basket");
  });

  it("recognizes specific fixed-cost categories like health insurance", () => {
    const categoryById = createCategoryMap([
      {
        id: "care-root",
        key: "care",
        name: "Zorg",
        parent_id: null,
        budget_group: "fixed",
        sort_order: 30,
      },
      {
        id: "health-insurance",
        key: "care_health_insurance",
        name: "Zorgverzekering",
        parent_id: "care-root",
        budget_group: "fixed",
        sort_order: 31,
      },
    ]);

    expect(
      resolveTransactionCategoryIconName(
        { category_id_auto: "health-insurance", category_id_user: null },
        categoryById,
      ),
    ).toBe("verified-user");
  });

  it("prefers specific subscription icons like Spotify", () => {
    const categoryById = createCategoryMap([
      {
        id: "subscriptions-root",
        key: "subscriptions_online",
        name: "Abonnementen & online",
        parent_id: null,
        budget_group: "fixed",
        sort_order: 70,
      },
      {
        id: "spotify",
        key: "subscriptions_online_spotify",
        name: "Spotify",
        parent_id: "subscriptions-root",
        budget_group: "fixed",
        sort_order: 72,
      },
    ]);

    expect(
      resolveTransactionCategoryIconName(
        { category_id_auto: "spotify", category_id_user: null },
        categoryById,
      ),
    ).toBe("music-note");
  });

  it("maps travel categories to a transit-style icon", () => {
    const categoryById = createCategoryMap([
      {
        id: "travel-root",
        key: "leisure_travel_stays",
        name: "Reizen & verblijf",
        parent_id: null,
        budget_group: "variable",
        sort_order: 97,
      },
    ]);

    expect(
      resolveTransactionCategoryIconName(
        { category_id_auto: "travel-root", category_id_user: null },
        categoryById,
      ),
    ).toBe("directions-transit");
  });

  it.each([
    [
      "housing allowance",
      [
        {
          id: "income-root",
          key: "income",
          name: "Inkomen",
          parent_id: null,
          budget_group: "income",
          sort_order: 10,
        },
        {
          id: "housing-allowance",
          key: "income_benefits_housing_allowance",
          name: "Huurtoeslag",
          parent_id: "income-root",
          budget_group: "income",
          sort_order: 16,
        },
      ],
      "home",
    ],
    [
      "health allowance",
      [
        {
          id: "income-root",
          key: "income",
          name: "Inkomen",
          parent_id: null,
          budget_group: "income",
          sort_order: 10,
        },
        {
          id: "health-allowance",
          key: "income_benefits_health_allowance",
          name: "Zorgtoeslag",
          parent_id: "income-root",
          budget_group: "income",
          sort_order: 17,
        },
      ],
      "verified-user",
    ],
    [
      "child benefit allowance",
      [
        {
          id: "income-root",
          key: "income",
          name: "Inkomen",
          parent_id: null,
          budget_group: "income",
          sort_order: 10,
        },
        {
          id: "child-allowance",
          key: "income_benefits_childcare_allowance",
          name: "Kinderopvangtoeslag",
          parent_id: "income-root",
          budget_group: "income",
          sort_order: 18,
        },
      ],
      "child-care",
    ],
    [
      "school support allowance",
      [
        {
          id: "income-root",
          key: "income",
          name: "Inkomen",
          parent_id: null,
          budget_group: "income",
          sort_order: 10,
        },
        {
          id: "school-support",
          key: "income_benefits_school_support",
          name: "Tegemoetkoming schoolkosten",
          parent_id: "income-root",
          budget_group: "income",
          sort_order: 21,
        },
      ],
      "school",
    ],
    [
      "pgb allowance",
      [
        {
          id: "income-root",
          key: "income",
          name: "Inkomen",
          parent_id: null,
          budget_group: "income",
          sort_order: 10,
        },
        {
          id: "pgb",
          key: "income_benefits_pgb",
          name: "Persoonsgebonden budget",
          parent_id: "income-root",
          budget_group: "income",
          sort_order: 22,
        },
      ],
      "medical-services",
    ],
  ])("maps %s to a dedicated benefit icon", (_label, categories, icon) => {
    const categoryById = createCategoryMap(categories as CategoryRecord[]);

    expect(
      resolveTransactionCategoryIconName(
        { category_id_auto: categories[1].id, category_id_user: null },
        categoryById,
      ),
    ).toBe(icon);
  });

  it("prefers the manual category when both auto and manual are present", () => {
    const categoryById = createCategoryMap([
      {
        id: "fuel",
        key: "auto_transport_fuel",
        name: "Brandstof",
        parent_id: null,
        budget_group: "variable",
        sort_order: 41,
      },
      {
        id: "parking",
        key: "auto_transport_parking",
        name: "Parkeren",
        parent_id: null,
        budget_group: "variable",
        sort_order: 45,
      },
    ]);

    expect(
      resolveTransactionCategoryIconName(
        {
          category_id_auto: "fuel",
          category_id_user: "parking",
        },
        categoryById,
      ),
    ).toBe("local-parking");
  });

  it("falls back safely for uncategorized transactions", () => {
    expect(
      resolveTransactionCategoryIconName(
        { category_id_auto: null, category_id_user: null },
        new Map(),
      ),
    ).toBe("help-outline");
  });
});
