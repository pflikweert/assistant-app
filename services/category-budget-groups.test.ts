import { beforeAll, describe, expect, it, vi } from "vitest";

import type { CategoryBudgetGroupOverrideRecord, CategoryRecord } from "@/types/categorization";

let applyEffectiveBudgetGroupsToCategories: typeof import("./category-budget-groups").applyEffectiveBudgetGroupsToCategories;
let buildCategoryBudgetGroupOverrideMap: typeof import("./category-budget-groups").buildCategoryBudgetGroupOverrideMap;
let getEffectiveBudgetGroup: typeof import("./category-budget-groups").getEffectiveBudgetGroup;
let getSystemBudgetGroup: typeof import("./category-budget-groups").getSystemBudgetGroup;
let isBudgetGroupManageableCategory: typeof import("./category-budget-groups").isBudgetGroupManageableCategory;
let isBudgetGroupOverrideActive: typeof import("./category-budget-groups").isBudgetGroupOverrideActive;

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {},
}));

vi.mock("@/services/forecast-refresh", () => ({
  markForecastDirty: vi.fn(),
}));

const categories: CategoryRecord[] = [
  {
    id: "root-housing",
    key: "housing",
    name: "Wonen",
    parent_id: null,
    budget_group: "fixed",
    sort_order: 10,
  },
  {
    id: "energy",
    key: "housing_energy",
    name: "Energie",
    parent_id: "root-housing",
    budget_group: null,
    sort_order: 11,
  },
  {
    id: "root-streaming",
    key: "subscriptions",
    name: "Abonnementen",
    parent_id: null,
    budget_group: "subscriptions",
    sort_order: 20,
  },
  {
    id: "streaming",
    key: "subscriptions_streaming",
    name: "Streaming",
    parent_id: "root-streaming",
    budget_group: "subscriptions",
    sort_order: 21,
  },
  {
    id: "root-shopping",
    key: "shopping",
    name: "Winkelen",
    parent_id: null,
    budget_group: "variable",
    sort_order: 30,
  },
  {
    id: "clothing",
    key: "shopping_clothing",
    name: "Kleding",
    parent_id: "root-shopping",
    budget_group: null,
    sort_order: 31,
  },
  {
    id: "root-savings",
    key: "savings",
    name: "Sparen",
    parent_id: null,
    budget_group: "savings",
    sort_order: 40,
  },
  {
    id: "savings-transfer",
    key: "savings_transfer",
    name: "Overboeken naar sparen",
    parent_id: "root-savings",
    budget_group: null,
    sort_order: 41,
  },
];

function buildCategoryMap(rows: CategoryRecord[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

describe("category-budget-groups", () => {
  beforeAll(async () => {
    ({
      applyEffectiveBudgetGroupsToCategories,
      buildCategoryBudgetGroupOverrideMap,
      getEffectiveBudgetGroup,
      getSystemBudgetGroup,
      isBudgetGroupManageableCategory,
      isBudgetGroupOverrideActive,
    } = await import("./category-budget-groups"));
  });

  it("derives the system budget group from the category tree and subscription keys", () => {
    const categoryMap = buildCategoryMap(categories);

    expect(getSystemBudgetGroup("energy", categoryMap)).toBe("fixed");
    expect(getSystemBudgetGroup("clothing", categoryMap)).toBe("variable");
    expect(getSystemBudgetGroup("streaming", categoryMap)).toBe("subscriptions");
    expect(getSystemBudgetGroup("savings-transfer", categoryMap)).toBe("savings");
  });

  it("lets a per-user override win over the inferred system group", () => {
    const categoryMap = buildCategoryMap(categories);
    const overrides: CategoryBudgetGroupOverrideRecord[] = [
      {
        categoryId: "streaming",
        budgetGroup: "variable",
        createdAt: null,
        updatedAt: null,
      },
    ];

    expect(
      getEffectiveBudgetGroup(
        "streaming",
        categoryMap,
        buildCategoryBudgetGroupOverrideMap(overrides),
      ),
    ).toBe("variable");
  });

  it("applies effective budget groups back onto category records for UI consumers", () => {
    const effectiveCategories = applyEffectiveBudgetGroupsToCategories(categories, [
      {
        categoryId: "streaming",
        budgetGroup: "variable",
        createdAt: null,
        updatedAt: null,
      },
    ]);
    const categoryMap = buildCategoryMap(effectiveCategories);

    expect(categoryMap.get("energy")?.budget_group).toBe("fixed");
    expect(categoryMap.get("clothing")?.budget_group).toBe("variable");
    expect(categoryMap.get("streaming")?.budget_group).toBe("variable");
    expect(categoryMap.get("savings-transfer")?.budget_group).toBe("savings");
  });

  it("distinguishes manageable leaf categories from roots and savings buckets", () => {
    const categoryMap = buildCategoryMap(categories);

    expect(isBudgetGroupManageableCategory(categories[1], categoryMap)).toBe(true);
    expect(isBudgetGroupManageableCategory(categories[3], categoryMap)).toBe(true);
    expect(isBudgetGroupManageableCategory(categories[0], categoryMap)).toBe(false);
    expect(isBudgetGroupManageableCategory(categories[7], categoryMap)).toBe(
      false,
    );
  });

  it("marks only changed overrides as active", () => {
    const categoryMap = buildCategoryMap(categories);
    const overrides: CategoryBudgetGroupOverrideRecord[] = [
      {
        categoryId: "streaming",
        budgetGroup: "variable",
        createdAt: null,
        updatedAt: null,
      },
      {
        categoryId: "energy",
        budgetGroup: "fixed",
        createdAt: null,
        updatedAt: null,
      },
    ];
    const overridesByCategoryId = buildCategoryBudgetGroupOverrideMap(overrides);

    expect(
      isBudgetGroupOverrideActive(
        "streaming",
        categoryMap,
        overridesByCategoryId,
      ),
    ).toBe(true);
    expect(
      isBudgetGroupOverrideActive("energy", categoryMap, overridesByCategoryId),
    ).toBe(false);
  });
});
