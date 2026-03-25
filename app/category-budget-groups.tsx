import { AppIcon } from "@/components/ui/app-icon";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import {
  BUDGET_GROUP_LABELS,
  EDITABLE_BUDGET_GROUPS,
  buildCategoryBudgetGroupOverrideMap,
  getEffectiveBudgetGroup,
  getSystemBudgetGroup,
  isBudgetGroupManageableCategory,
  isBudgetGroupOverrideActive,
  listCategoryBudgetGroupOverrides,
  resetCategoryBudgetGroupOverride,
  upsertCategoryBudgetGroupOverride,
} from "@/services/category-budget-groups";
import { getTransactionCategories } from "@/services/categorization-repository";
import { markForecastDirty } from "@/services/forecast-refresh";
import { buildCategoryRecordMap, sortCategories } from "@/services/category-display";
import type {
  CategoryBudgetGroupOverrideRecord,
  CategoryRecord,
  EditableBudgetGroup,
} from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type CategorySection = {
  id: string;
  title: string;
  sortOrder: number;
  categories: CategoryRecord[];
};

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeSearch(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRootCategoryForCategory(
  category: CategoryRecord,
  categoryById: Map<string, CategoryRecord>,
) {
  let current: CategoryRecord | null = category;
  const visited = new Set<string>();

  while (current?.parent_id && !visited.has(current.id)) {
    visited.add(current.id);
    const parent: CategoryRecord | null =
      categoryById.get(current.parent_id) || null;
    if (!parent) break;
    current = parent;
  }

  return current;
}

function getCategoryContextLabel(
  category: CategoryRecord,
  categoryById: Map<string, CategoryRecord>,
  rootId: string,
) {
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = category.parent_id ? categoryById.get(category.parent_id) || null : null;

  while (current && current.id !== rootId && !visited.has(current.id)) {
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parent_id ? categoryById.get(current.parent_id) || null : null;
  }

  return parts.join(" / ");
}

function applyOverrideState(
  current: CategoryBudgetGroupOverrideRecord[],
  categoryId: string,
  budgetGroup: EditableBudgetGroup | null,
) {
  const next = current.filter((item) => item.categoryId !== categoryId);
  if (!budgetGroup) return next;

  return [
    {
      categoryId,
      budgetGroup,
      createdAt: null,
      updatedAt: new Date().toISOString(),
    },
    ...next,
  ];
}

export default function CategoryBudgetGroupsScreen() {
  const params = useLocalSearchParams<{ categoryId?: string | string[] }>();
  const router = useRouter();
  const focusCategoryId = React.useMemo(
    () => normalizeRouteParam(params.categoryId),
    [params.categoryId],
  );
  const isFocused = useIsFocused();
  const handledFocusCategoryIdRef = React.useRef<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [overrides, setOverrides] = React.useState<
    CategoryBudgetGroupOverrideRecord[]
  >([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [onlyOverrides, setOnlyOverrides] = React.useState(false);
  const [savingCategoryId, setSavingCategoryId] = React.useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [rawCategories, nextOverrides] = await Promise.all([
        getTransactionCategories({ applyBudgetGroupOverrides: false }),
        listCategoryBudgetGroupOverrides(),
      ]);

      setCategories(rawCategories);
      setOverrides(nextOverrides);
    } catch (error) {
      console.error("[category-budget-groups] load error", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Kon categorie-indeling niet laden.",
      );
      setCategories([]);
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadData();
  }, [isFocused, loadData]);

  const categoryById = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );
  const overridesByCategoryId = React.useMemo(
    () => buildCategoryBudgetGroupOverrideMap(overrides),
    [overrides],
  );
  const focusCategory = focusCategoryId
    ? categoryById.get(focusCategoryId) || null
    : null;

  React.useEffect(() => {
    if (!focusCategoryId || !focusCategory) return;
    if (handledFocusCategoryIdRef.current === focusCategoryId) return;

    handledFocusCategoryIdRef.current = focusCategoryId;
    setSearchQuery(focusCategory.name);
  }, [focusCategory, focusCategoryId]);

  const sections = React.useMemo(() => {
    const searchTokens = normalizeSearch(searchQuery)
      .split(" ")
      .filter(Boolean);

    const grouped = new Map<string, CategorySection>();

    for (const category of categories) {
      if (!isBudgetGroupManageableCategory(category, categoryById)) continue;

      const systemGroup = getSystemBudgetGroup(category.id, categoryById);
      const effectiveGroup = getEffectiveBudgetGroup(
        category.id,
        categoryById,
        overridesByCategoryId,
      );
      const overrideActive = isBudgetGroupOverrideActive(
        category.id,
        categoryById,
        overridesByCategoryId,
      );
      if (!systemGroup || !effectiveGroup) continue;
      if (onlyOverrides && !overrideActive) continue;

      const rootCategory = getRootCategoryForCategory(category, categoryById);
      const sectionId = rootCategory?.id || "uncategorized";
      const sectionTitle = rootCategory?.name || "Overig";
      const contextLabel = getCategoryContextLabel(
        category,
        categoryById,
        sectionId,
      );
      const searchHaystack = normalizeSearch(
        [
          category.name,
          sectionTitle,
          contextLabel,
          BUDGET_GROUP_LABELS[systemGroup],
          BUDGET_GROUP_LABELS[effectiveGroup],
        ].join(" "),
      );
      const matchesSearch = searchTokens.every((token) =>
        searchHaystack.includes(token),
      );
      if (!matchesSearch) continue;

      const existing = grouped.get(sectionId);
      if (existing) {
        existing.categories.push(category);
        continue;
      }

      grouped.set(sectionId, {
        id: sectionId,
        title: sectionTitle,
        sortOrder: rootCategory?.sort_order ?? Number.MAX_SAFE_INTEGER,
        categories: [category],
      });
    }

    return Array.from(grouped.values())
      .map((section) => ({
        ...section,
        categories: sortCategories(section.categories),
      }))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.title.localeCompare(right.title, "nl");
      });
  }, [
    categories,
    categoryById,
    onlyOverrides,
    overridesByCategoryId,
    searchQuery,
  ]);

  const manageableCategoryCount = React.useMemo(
    () =>
      categories.filter((category) =>
        isBudgetGroupManageableCategory(category, categoryById),
      ).length,
    [categories, categoryById],
  );
  const activeOverrideCount = React.useMemo(
    () =>
      categories.filter((category) =>
        isBudgetGroupOverrideActive(
          category.id,
          categoryById,
          overridesByCategoryId,
        ),
      ).length,
    [categories, categoryById, overridesByCategoryId],
  );

  const handleSelectBudgetGroup = React.useCallback(
    async (categoryId: string, nextGroup: EditableBudgetGroup) => {
      const systemGroup = getSystemBudgetGroup(categoryId, categoryById);
      const activeGroup = getEffectiveBudgetGroup(
        categoryId,
        categoryById,
        overridesByCategoryId,
      );
      if (!systemGroup || activeGroup === nextGroup) return;

      setSavingCategoryId(categoryId);
      setErrorMessage(null);
      try {
        if (systemGroup === nextGroup) {
          await resetCategoryBudgetGroupOverride(categoryId);
          await markForecastDirty("budget_save").catch((refreshError) => {
            console.warn(
              "[category-budget-groups] forecast dirty mark after reset failed",
              refreshError,
            );
          });
          setOverrides((current) => applyOverrideState(current, categoryId, null));
        } else {
          await upsertCategoryBudgetGroupOverride({
            categoryId,
            budgetGroup: nextGroup,
          });
          await markForecastDirty("budget_save").catch((refreshError) => {
            console.warn(
              "[category-budget-groups] forecast dirty mark after override failed",
              refreshError,
            );
          });
          setOverrides((current) =>
            applyOverrideState(current, categoryId, nextGroup),
          );
        }
      } catch (error) {
        console.error("[category-budget-groups] save error", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Kon budgetgroep niet opslaan.",
        );
      } finally {
        setSavingCategoryId(null);
      }
    },
    [categoryById, overridesByCategoryId],
  );

  const handleResetCategory = React.useCallback(async (categoryId: string) => {
    setSavingCategoryId(categoryId);
    setErrorMessage(null);
    try {
      await resetCategoryBudgetGroupOverride(categoryId);
      await markForecastDirty("budget_save").catch((refreshError) => {
        console.warn(
          "[category-budget-groups] forecast dirty mark after reset failed",
          refreshError,
        );
      });
      setOverrides((current) => applyOverrideState(current, categoryId, null));
    } catch (error) {
      console.error("[category-budget-groups] reset error", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Kon wijziging niet resetten.",
      );
    } finally {
      setSavingCategoryId(null);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.root}>
        <FinanceScreenBackdrop tone="warm" />
        <FinanceDetailTopBar
          title="Categorie-indeling"
          onBack={() => router.back()}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={FinColors.green} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDetailTopBar
        title="Categorie-indeling"
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Budgetgroep per categorie</Text>
          <Text style={styles.heroText}>
            Hier stuur je alleen de budgetbak aan. De transactiecategorie zelf
            blijft ongewijzigd.
          </Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Text style={styles.heroMetaValue}>{manageableCategoryCount}</Text>
              <Text style={styles.heroMetaLabel}>beheerbare categorieen</Text>
            </View>
            <View style={styles.heroMetaPill}>
              <Text style={styles.heroMetaValue}>{activeOverrideCount}</Text>
              <Text style={styles.heroMetaLabel}>aangepaste indelingen</Text>
            </View>
          </View>
          {focusCategory ? (
            <View style={styles.focusBanner}>
              <AppIcon
                name="push-pin"
                size={16}
                color={FinColors.warningText}
                variant="outlined"
              />
              <Text style={styles.focusBannerText}>
                Gefocust op {focusCategory.name}
              </Text>
            </View>
          ) : null}
        </View>

      <View style={styles.controlsCard}>
        <View style={styles.searchWrap}>
          <AppIcon
            name="search"
            size={18}
            color={FinColors.textMuted}
            style={styles.searchIcon}
            variant="outlined"
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Zoek een categorie"
            placeholderTextColor={FinColors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              !onlyOverrides && styles.filterChipActive,
            ]}
            onPress={() => setOnlyOverrides(false)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                !onlyOverrides && styles.filterChipTextActive,
              ]}
            >
              Alles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              onlyOverrides && styles.filterChipActive,
            ]}
            onPress={() => setOnlyOverrides(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                onlyOverrides && styles.filterChipTextActive,
              ]}
            >
              Alleen afwijkingen
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Opslaan mislukt</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {!sections.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Geen categorieen gevonden</Text>
          <Text style={styles.emptyText}>
            Pas je zoekterm of filter aan om een categorie terug te zien.
          </Text>
        </View>
      ) : null}

      {sections.map((section) => (
        <View key={section.id} style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.categories.map((category, index) => {
              const systemGroup = getSystemBudgetGroup(category.id, categoryById);
              const activeGroup = getEffectiveBudgetGroup(
                category.id,
                categoryById,
                overridesByCategoryId,
              );
              const overrideActive = isBudgetGroupOverrideActive(
                category.id,
                categoryById,
                overridesByCategoryId,
              );
              const saving = savingCategoryId === category.id;
              const contextLabel = getCategoryContextLabel(
                category,
                categoryById,
                section.id,
              );

              if (!systemGroup || !activeGroup) return null;

              return (
                <View
                  key={category.id}
                  style={[
                    styles.categoryRow,
                    index < section.categories.length - 1 && styles.categoryRowBorder,
                    focusCategoryId === category.id && styles.categoryRowFocused,
                  ]}
                >
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      {contextLabel ? (
                        <Text style={styles.categoryContext}>{contextLabel}</Text>
                      ) : null}
                      <Text style={styles.categoryMeta}>
                        Standaard: {BUDGET_GROUP_LABELS[systemGroup]}
                        {overrideActive
                          ? `  •  Actief: ${BUDGET_GROUP_LABELS[activeGroup]}`
                          : ""}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.stateBadge,
                        overrideActive
                          ? styles.stateBadgeCustom
                          : styles.stateBadgeDefault,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stateBadgeText,
                          overrideActive
                            ? styles.stateBadgeTextCustom
                            : styles.stateBadgeTextDefault,
                        ]}
                      >
                        {overrideActive ? "Aangepast" : "Standaard"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.optionRow}>
                    {EDITABLE_BUDGET_GROUPS.map((group) => {
                      const active = activeGroup === group;
                      return (
                        <TouchableOpacity
                          key={group}
                          style={[
                            styles.optionChip,
                            active && styles.optionChipActive,
                          ]}
                          onPress={() =>
                            void handleSelectBudgetGroup(category.id, group)
                          }
                          activeOpacity={0.8}
                          disabled={saving}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && styles.optionChipTextActive,
                            ]}
                          >
                            {BUDGET_GROUP_LABELS[group]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.rowFooter}>
                    {overrideActive ? (
                      <TouchableOpacity
                        onPress={() => void handleResetCategory(category.id)}
                        activeOpacity={0.8}
                        disabled={saving}
                      >
                        <Text style={styles.resetText}>Reset naar standaard</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.footerHint}>
                        Gebruikt systeemdefault
                      </Text>
                    )}
                    {saving ? (
                      <ActivityIndicator size="small" color={FinColors.green} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  heroCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 22,
  },
  heroTitle: {
    color: FinColors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
  },
  heroText: {
    marginTop: 10,
    color: FinColors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroMetaPill: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroMetaValue: {
    color: FinColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  heroMetaLabel: {
    marginTop: 2,
    color: FinColors.textSecondary,
    fontSize: 12,
  },
  focusBanner: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  focusBannerText: {
    color: FinColors.warningText,
    fontSize: 13,
    fontWeight: "600",
  },
  controlsCard: {
    marginTop: 16,
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 16,
  },
  searchWrap: {
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 16,
  },
  searchInput: {
    paddingLeft: 42,
    paddingRight: 14,
    paddingVertical: 16,
    color: FinColors.textPrimary,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  filterChipText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: FinColors.bgCard,
  },
  errorCard: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: FinColors.redBg,
    borderWidth: 1,
    borderColor: FinColors.red,
    padding: 14,
  },
  errorTitle: {
    color: FinColors.red,
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 4,
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyCard: {
    marginTop: 18,
    alignItems: "center",
    ...FinSurfaces.topLevelCard,
    borderRadius: 20,
    padding: 24,
  },
  emptyTitle: {
    color: FinColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 8,
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  sectionWrap: {
    marginTop: 18,
  },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    color: FinColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  categoryRow: {
    paddingVertical: 16,
  },
  categoryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FinColors.borderSubtle,
  },
  categoryRowFocused: {
    backgroundColor: FinColors.warningBg,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  categoryCopy: {
    flex: 1,
  },
  categoryName: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  categoryContext: {
    marginTop: 2,
    color: FinColors.textMuted,
    fontSize: 12,
  },
  categoryMeta: {
    marginTop: 6,
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  stateBadgeDefault: {
    backgroundColor: FinColors.bgInput,
    borderColor: FinColors.borderSubtle,
  },
  stateBadgeCustom: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  stateBadgeTextDefault: {
    color: FinColors.textSecondary,
  },
  stateBadgeTextCustom: {
    color: FinColors.warningText,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionChipActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  optionChipText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  optionChipTextActive: {
    color: FinColors.bgCard,
  },
  rowFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resetText: {
    color: "#705B00",
    fontSize: 12,
    fontWeight: "700",
  },
  footerHint: {
    color: FinColors.textMuted,
    fontSize: 12,
  },
});
