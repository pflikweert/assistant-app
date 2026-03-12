import type { CategoryRecord } from "@/types/categorization";

type CategorizedRow = {
  category_id_auto?: string | null;
  category_id_user?: string | null;
  category_confidence?: number | null;
  category_source?: string | null;
};

export const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

export function getEffectiveCategoryId(row: CategorizedRow): string | null {
  return row.category_id_user || row.category_id_auto || null;
}

export function buildCategoryNameMap(categories: CategoryRecord[]) {
  return new Map(categories.map((category) => [category.id, category.name]));
}

export function buildCategoryRecordMap(categories: CategoryRecord[]) {
  return new Map(categories.map((category) => [category.id, category]));
}

export function sortCategories(categories: CategoryRecord[]) {
  return [...categories].sort((a, b) => {
    const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    return a.name.localeCompare(b.name, "nl");
  });
}

export function getLeafCategories(
  categories: CategoryRecord[],
  options: { curatedOnly?: boolean } = {},
) {
  const parentIds = new Set(
    categories.map((category) => category.parent_id).filter(Boolean),
  );
  const leaves = categories.filter((category) => !parentIds.has(category.id));
  const source = leaves.length ? leaves : categories;
  const filtered = options.curatedOnly
    ? source.filter((category) => category.sort_order != null)
    : source;

  return sortCategories(filtered.length ? filtered : source);
}

export function getCategoryLabel(
  row: CategorizedRow,
  categoryMap: Map<string, string>,
  fallback = "Ongecategoriseerd",
) {
  const categoryId = getEffectiveCategoryId(row);
  if (!categoryId) return fallback;
  return categoryMap.get(categoryId) || fallback;
}

export function getCategoryPathLabel(
  row: CategorizedRow,
  categoryById: Map<string, CategoryRecord>,
  fallback = "Ongecategoriseerd",
) {
  const categoryId = getEffectiveCategoryId(row);
  if (!categoryId) return fallback;

  const child = categoryById.get(categoryId);
  if (!child) return fallback;

  const parent = child.parent_id ? categoryById.get(child.parent_id) : null;
  return parent ? `${parent.name} › ${child.name}` : child.name;
}

export function getCategorizationCoverage(rows: CategorizedRow[]) {
  let categorized = 0;
  let manual = 0;

  for (const row of rows) {
    if (row.category_id_user) {
      manual += 1;
      categorized += 1;
      continue;
    }
    if (row.category_id_auto) categorized += 1;
  }

  return {
    total: rows.length,
    categorized,
    uncategorized: Math.max(rows.length - categorized, 0),
    manual,
    auto: Math.max(categorized - manual, 0),
  };
}

export function needsCategorizationReview(
  row: CategorizedRow,
  threshold = REVIEW_CONFIDENCE_THRESHOLD,
) {
  if (row.category_id_user) return false;
  if (!row.category_id_auto) return true;
  if (row.category_source === "fallback") return true;

  const confidence = row.category_confidence;
  if (confidence == null) return true;

  return confidence < threshold;
}

export function formatConfidenceLabel(row: CategorizedRow) {
  if (row.category_id_user) return "Handmatig bevestigd";
  if (row.category_confidence == null) {
    return row.category_source === "fallback"
      ? "Review nodig"
      : "Geen confidence";
  }

  const pct = Math.round(row.category_confidence * 100);
  const source = row.category_source || "auto";
  return `${pct}% ${source}`;
}
