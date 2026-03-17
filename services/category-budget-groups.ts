import { requireCurrentUserId } from "@/services/current-user";
import { supabase } from "@/services/supabase";
import type {
  CategoryBudgetGroupOverrideRecord,
  CategoryRecord,
  EditableBudgetGroup,
  EffectiveBudgetGroup,
} from "@/types/categorization";

type OverrideRow = Record<string, unknown>;

export const EDITABLE_BUDGET_GROUPS: EditableBudgetGroup[] = [
  "fixed",
  "variable",
  "subscriptions",
];

export const BUDGET_GROUP_LABELS: Record<EditableBudgetGroup | "savings", string> = {
  fixed: "Vaste lasten",
  variable: "Variabel",
  subscriptions: "Abonnementen",
  savings: "Sparen",
};

function isEditableBudgetGroup(value: unknown): value is EditableBudgetGroup {
  return (
    value === "fixed" ||
    value === "variable" ||
    value === "subscriptions"
  );
}

function normalizeKey(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
}

function buildCategoryMap(categories: CategoryRecord[]) {
  return new Map(categories.map((category) => [category.id, category]));
}

function getCategoryTrail(
  categoryId: string | null | undefined,
  categoryById: Map<string, CategoryRecord>,
) {
  const trail: CategoryRecord[] = [];
  const visited = new Set<string>();
  let current = categoryId ? categoryById.get(categoryId) || null : null;

  while (current && !visited.has(current.id)) {
    trail.push(current);
    visited.add(current.id);
    current = current.parent_id ? categoryById.get(current.parent_id) || null : null;
  }

  return trail;
}

function mapOverrideRow(row: OverrideRow): CategoryBudgetGroupOverrideRecord | null {
  const categoryId = String(row.category_id || "");
  const budgetGroup = row.budget_group;
  if (!categoryId || !isEditableBudgetGroup(budgetGroup)) {
    return null;
  }

  return {
    categoryId,
    budgetGroup,
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export function buildCategoryBudgetGroupOverrideMap(
  overrides: CategoryBudgetGroupOverrideRecord[],
) {
  return new Map(
    overrides.map((override) => [override.categoryId, override]),
  );
}

export function getSystemBudgetGroup(
  categoryId: string | null | undefined,
  categoryById: Map<string, CategoryRecord>,
): EffectiveBudgetGroup {
  const trail = getCategoryTrail(categoryId, categoryById);
  if (!trail.length) return null;

  for (const category of trail) {
    const budgetGroup = normalizeKey(category.budget_group);
    if (
      budgetGroup === "fixed" ||
      budgetGroup === "variable" ||
      budgetGroup === "subscriptions" ||
      budgetGroup === "savings"
    ) {
      return budgetGroup;
    }
  }

  for (const category of trail) {
    const key = normalizeKey(category.key);
    if (
      key === "savings" ||
      key === "savings_transfer" ||
      key.startsWith("savings_")
    ) {
      return "savings";
    }
    if (
      key === "subscriptions" ||
      key.startsWith("subscriptions_") ||
      key.startsWith("subscription_")
    ) {
      return "subscriptions";
    }
  }

  return null;
}

export function getEffectiveBudgetGroup(
  categoryId: string | null | undefined,
  categoryById: Map<string, CategoryRecord>,
  overridesByCategoryId: Map<string, CategoryBudgetGroupOverrideRecord>,
): EffectiveBudgetGroup {
  if (!categoryId) return null;
  const override = overridesByCategoryId.get(categoryId);
  if (override) return override.budgetGroup;
  return getSystemBudgetGroup(categoryId, categoryById);
}

export function applyEffectiveBudgetGroupsToCategories(
  categories: CategoryRecord[],
  overrides: CategoryBudgetGroupOverrideRecord[],
): CategoryRecord[] {
  const categoryById = buildCategoryMap(categories);
  const overridesByCategoryId = buildCategoryBudgetGroupOverrideMap(overrides);

  return categories.map((category) => ({
    ...category,
    budget_group: getEffectiveBudgetGroup(
      category.id,
      categoryById,
      overridesByCategoryId,
    ),
  }));
}

export function getBudgetGroupLabel(group: string | null | undefined) {
  if (
    group !== "fixed" &&
    group !== "variable" &&
    group !== "subscriptions" &&
    group !== "savings"
  ) {
    return null;
  }

  return BUDGET_GROUP_LABELS[group];
}

export function isBudgetGroupOverrideActive(
  categoryId: string,
  categoryById: Map<string, CategoryRecord>,
  overridesByCategoryId: Map<string, CategoryBudgetGroupOverrideRecord>,
) {
  if (!overridesByCategoryId.has(categoryId)) return false;
  const override = overridesByCategoryId.get(categoryId);
  if (!override) return false;
  return override.budgetGroup !== getSystemBudgetGroup(categoryId, categoryById);
}

export function isBudgetGroupManageableCategory(
  category: CategoryRecord,
  categoryById: Map<string, CategoryRecord>,
) {
  const parentIds = new Set(
    Array.from(categoryById.values())
      .map((item) => item.parent_id)
      .filter(Boolean),
  );
  if (parentIds.has(category.id)) return false;

  const systemGroup = getSystemBudgetGroup(category.id, categoryById);
  return (
    systemGroup === "fixed" ||
    systemGroup === "variable" ||
    systemGroup === "subscriptions"
  );
}

export async function listCategoryBudgetGroupOverrides(userId?: string) {
  const resolvedUserId = userId || (await requireCurrentUserId());
  const { data, error } = await supabase
    .from("category_budget_group_overrides")
    .select("category_id,budget_group,created_at,updated_at")
    .eq("user_id", resolvedUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (
      String((error as { code?: string }).code || "") === "42P01" ||
      String((error as { code?: string }).code || "") === "PGRST205"
    ) {
      return [] as CategoryBudgetGroupOverrideRecord[];
    }
    throw error;
  }

  return ((data || []) as OverrideRow[])
    .map(mapOverrideRow)
    .filter(
      (row): row is CategoryBudgetGroupOverrideRecord => Boolean(row),
    );
}

export async function upsertCategoryBudgetGroupOverride(input: {
  categoryId: string;
  budgetGroup: EditableBudgetGroup;
}) {
  const userId = await requireCurrentUserId();
  const payload = {
    user_id: userId,
    category_id: input.categoryId,
    budget_group: input.budgetGroup,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("category_budget_group_overrides")
    .upsert(payload, { onConflict: "user_id,category_id" });

  if (error) throw error;
}

export async function resetCategoryBudgetGroupOverride(categoryId: string) {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from("category_budget_group_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("category_id", categoryId);

  if (error) throw error;
}
