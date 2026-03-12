import { TransactionCategoryIcon } from "@/components/category-icon";
import { FinColors } from "@/constants/theme";
import { recategorizeSingleTransaction } from "@/services/categorization";
import {
    bulkUpdateCategoryByCounterparty,
    countCounterpartyTransactions,
    getCounterpartyTransactions,
    getTransactionCategories,
    getTransactionDetail,
    setTransactionManualCategory,
    setTransactionReviewed,
    type CounterpartyTxSummary,
    type TransactionDetail,
} from "@/services/categorization-repository";
import {
    getCategoryPathLabel,
    getLeafCategories,
} from "@/services/category-display";
import type { CategoryRecord } from "@/types/categorization";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function truncateMsg(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const SUBJECT_DRIVEN_PROVIDERS = [
  "klarna",
  "paypal",
  "riverty",
  "afterpay",
  "billink",
  "in3",
  "sprinque",
];

function isSubjectDrivenCounterparty(counterparty: string | null | undefined) {
  const normalized = String(counterparty || "").toLowerCase();
  if (!normalized) return false;
  return SUBJECT_DRIVEN_PROVIDERS.some((token) => normalized.includes(token));
}

function getSubjectFromDetails(details: string) {
  return details.split("|")[0]?.trim() || details;
}

type AiSuggestion = {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  parentName: string | null;
  confidence: number;
  reason: string;
  isSameAsCurrent: boolean;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [tx, setTx] = React.useState<TransactionDetail | null>(null);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [history, setHistory] = React.useState<CounterpartyTxSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showPicker, setShowPicker] = React.useState(false);
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [aiState, setAiState] = React.useState<
    "idle" | "loading" | "result" | "error"
  >("idle");
  const [aiSuggestion, setAiSuggestion] = React.useState<AiSuggestion | null>(
    null,
  );
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [bulkPhase, setBulkPhase] = React.useState<
    "idle" | "confirming" | "updating" | "done"
  >("idle");
  const [bulkScope, setBulkScope] = React.useState<"uncategorized" | "all">(
    "uncategorized",
  );
  const [bulkCounts, setBulkCounts] = React.useState<{
    uncategorized: number;
    all: number;
  } | null>(null);
  const [reviewToggling, setReviewToggling] = React.useState(false);

  // ── Derived maps ───────────────────────────────────────────────────────
  const categoryById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const leafCategories = React.useMemo(
    () => getLeafCategories(categories, { curatedOnly: true }),
    [categories],
  );

  const categoryGroups = React.useMemo(() => {
    const groups = new Map<string | null, CategoryRecord[]>();
    for (const cat of leafCategories) {
      const pid = cat.parent_id || null;
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid)!.push(cat);
    }
    return Array.from(groups.entries())
      .map(([pid, leaves]) => ({
        parent: pid ? categoryById.get(pid) || null : null,
        leaves,
      }))
      .sort((a, b) =>
        (a.parent?.name ?? "\uFFFF").localeCompare(
          b.parent?.name ?? "\uFFFF",
          "nl",
        ),
      );
  }, [leafCategories, categoryById]);

  const effectiveCategoryId =
    tx?.category_id_user || tx?.category_id_auto || null;
  const effectiveCategory = effectiveCategoryId
    ? categoryById.get(effectiveCategoryId) || null
    : null;
  const parentCategory = effectiveCategory?.parent_id
    ? categoryById.get(effectiveCategory.parent_id) || null
    : null;
  const isSubjectDrivenProvider = React.useMemo(
    () => isSubjectDrivenCounterparty(tx?.counterparty),
    [tx?.counterparty],
  );

  // ── Data loading ────────────────────────────────────────────────────────
  const loadData = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, cats] = await Promise.all([
        getTransactionDetail(id),
        getTransactionCategories(),
      ]);
      setTx(detail);
      setCategories(cats);
      if (detail?.counterparty) {
        const hist = await getCounterpartyTransactions(
          detail.counterparty,
          id,
          5,
        );
        setHistory(hist);
      }
    } catch (e) {
      console.warn("transaction-detail load error", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Manual category ─────────────────────────────────────────────────────
  const handleManualCategory = React.useCallback(
    async (categoryId: string) => {
      if (!id) return;
      setSavingCategory(true);
      try {
        await setTransactionManualCategory(id, categoryId, {
          reason: "handmatige wijziging",
          learnFromCounterparty: !isSubjectDrivenCounterparty(tx?.counterparty),
        });
        setShowPicker(false);
        const detail = await getTransactionDetail(id);
        setTx(detail);
      } catch (e) {
        console.warn("setCategory error", e);
      } finally {
        setSavingCategory(false);
      }
    },
    [id, tx?.counterparty],
  );

  // ── AI reclassification ─────────────────────────────────────────────────
  const handleAiReclassify = React.useCallback(async () => {
    if (!id || !tx) return;
    setAiState("loading");
    setAiSuggestion(null);
    setAiError(null);
    setShowPicker(false);
    try {
      const result = await recategorizeSingleTransaction(id);
      if (!result) {
        setAiError("Geen resultaat ontvangen van AI.");
        setAiState("error");
        return;
      }
      const resultCat = categoryById.get(result.categoryId);
      const parent = resultCat?.parent_id
        ? categoryById.get(resultCat.parent_id) || null
        : null;
      const isSameAsCurrent =
        result.categoryId === (tx.category_id_user || tx.category_id_auto);
      setAiSuggestion({
        ...result,
        parentName: parent?.name ?? null,
        isSameAsCurrent,
      });
      setAiState("result");
    } catch (e) {
      setAiError(truncateMsg(e instanceof Error ? e.message : String(e), 200));
      setAiState("error");
    }
  }, [id, tx, categoryById]);

  const handleApplyAi = React.useCallback(
    async (learnRule: boolean) => {
      if (!id || !aiSuggestion) return;
      setSavingCategory(true);
      try {
        await setTransactionManualCategory(id, aiSuggestion.categoryId, {
          reason: "AI herclassificatie",
          learnFromCounterparty:
            learnRule && !isSubjectDrivenCounterparty(tx?.counterparty),
        });
        const detail = await getTransactionDetail(id);
        setTx(detail);
        setAiState("idle");
        setAiSuggestion(null);

        if (
          detail?.counterparty &&
          !isSubjectDrivenCounterparty(detail.counterparty)
        ) {
          const [uncatCount, allCount] = await Promise.all([
            countCounterpartyTransactions(detail.counterparty, "uncategorized"),
            countCounterpartyTransactions(detail.counterparty, "all"),
          ]);
          setBulkCounts({ uncategorized: uncatCount, all: allCount });
          setBulkPhase("confirming");
        } else {
          setBulkPhase("idle");
        }
      } catch (e) {
        console.warn("apply AI error", e);
      } finally {
        setSavingCategory(false);
      }
    },
    [id, aiSuggestion, tx?.counterparty],
  );

  // ── Bulk update ─────────────────────────────────────────────────────────
  const handleBulkUpdate = React.useCallback(async () => {
    if (!tx?.counterparty || !tx?.category_id_user || !id) return;
    setBulkPhase("updating");
    try {
      await bulkUpdateCategoryByCounterparty(
        tx.counterparty,
        tx.category_id_user,
        bulkScope,
      );
      const hist = await getCounterpartyTransactions(tx.counterparty, id, 5);
      setHistory(hist);
      setBulkPhase("done");
    } catch (e) {
      console.warn("bulk update error", e);
      setBulkPhase("confirming");
    }
  }, [tx, id, bulkScope]);

  // ── Reviewed toggle ─────────────────────────────────────────────────────
  const handleReviewToggle = React.useCallback(
    async (value: boolean) => {
      if (!id || reviewToggling) return;
      setReviewToggling(true);
      setTx((prev) => (prev ? { ...prev, is_reviewed: value } : prev));
      try {
        await setTransactionReviewed(id, value);
      } catch (e) {
        setTx((prev) => (prev ? { ...prev, is_reviewed: !value } : prev));
        console.warn("review toggle error", e);
      } finally {
        setReviewToggling(false);
      }
    },
    [id, reviewToggling],
  );

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={FinColors.green} size="large" />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Transactie niet gevonden.</Text>
      </View>
    );
  }

  const saldoNaTrn = parseSaldo(tx.metadata["Saldo na trn"]);
  const omschrijving = tx.details.split("|")[0]?.trim() || tx.details;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.counterparty} numberOfLines={2}>
            {tx.counterparty || "Onbekende tegenpartij"}
          </Text>
          <View style={styles.reviewedBox}>
            <Text style={styles.reviewedLabel}>Beoordeeld</Text>
            <Switch
              value={tx.is_reviewed}
              onValueChange={handleReviewToggle}
              disabled={reviewToggling}
              trackColor={{
                false: FinColors.bgElevated,
                true: FinColors.greenBorder,
              }}
              thumbColor={
                tx.is_reviewed ? FinColors.green : FinColors.textMuted
              }
            />
          </View>
        </View>
        <Text
          style={[
            styles.amount,
            { color: tx.amount < 0 ? FinColors.red : FinColors.green },
          ]}
        >
          {tx.amount < 0 ? "−" : "+"}
          {euroFormatter.format(Math.abs(tx.amount))}
        </Text>
        <Text style={styles.dateText}>{tx.date}</Text>
      </View>

      {/* ── Info ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Transactiegegevens</Text>
        <InfoRow label="Omschrijving" value={omschrijving} />
        {tx.type ? <InfoRow label="Type" value={tx.type} /> : null}
        {tx.currency ? <InfoRow label="Valuta" value={tx.currency} /> : null}
        {saldoNaTrn != null ? (
          <InfoRow
            label="Saldo na transactie"
            value={euroFormatter.format(saldoNaTrn)}
          />
        ) : null}
        {tx.created_at ? (
          <InfoRow
            label="Aangemaakt op"
            value={new Date(tx.created_at).toLocaleDateString("nl-NL", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          />
        ) : null}
      </View>

      {/* ── Category ────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Categorie</Text>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => {
              setShowPicker((v) => !v);
              setAiState("idle");
            }}
            disabled={savingCategory}
          >
            <Text style={styles.smallBtnText}>
              {showPicker ? "Sluiten" : "Wijzig"}
            </Text>
          </TouchableOpacity>
        </View>

        {effectiveCategory ? (
          <View style={styles.badgesRow}>
            {parentCategory ? (
              <Text style={styles.parentBadge}>{parentCategory.name}</Text>
            ) : null}
            <Text style={styles.categoryBadge}>{effectiveCategory.name}</Text>
          </View>
        ) : (
          <Text style={styles.mutedText}>Ongecategoriseerd</Text>
        )}

        <View style={styles.metaRow}>
          {tx.category_id_user ? (
            <Text style={styles.sourcePill}>● Handmatig</Text>
          ) : tx.category_source ? (
            <Text style={styles.sourcePill}>
              ●{" "}
              {tx.category_source === "rule"
                ? "Regel"
                : tx.category_source === "openai"
                  ? "AI"
                  : tx.category_source === "fallback"
                    ? "Onbekend"
                    : tx.category_source}
            </Text>
          ) : null}
          {tx.category_confidence != null && !tx.category_id_user ? (
            <Text style={styles.mutedText}>
              {Math.round(tx.category_confidence * 100)}% zekerheid
            </Text>
          ) : null}
        </View>

        {/* ── Category picker ─────────────────────────────────────────── */}
        {showPicker ? (
          <View style={styles.pickerWrap}>
            {savingCategory ? (
              <ActivityIndicator
                color={FinColors.green}
                style={{ margin: 16 }}
              />
            ) : (
              categoryGroups.map((group) => (
                <View key={group.parent?.id ?? "__root"}>
                  <Text style={styles.pickerGroup}>
                    {group.parent?.name ?? "Overige"}
                  </Text>
                  {group.leaves.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.pickerItem,
                        effectiveCategoryId === cat.id &&
                          styles.pickerItemActive,
                      ]}
                      onPress={() => void handleManualCategory(cat.id)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          effectiveCategoryId === cat.id &&
                            styles.pickerItemTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {effectiveCategoryId === cat.id ? (
                        <Text style={styles.checkmark}>✓</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* ── AI Reclassification ──────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI Herclassificatie</Text>
        <Text style={styles.mutedText}>
          Opnieuw classificeren via AI — bestaande regels en cache worden
          genegeerd.
        </Text>
        {isSubjectDrivenProvider ? (
          <Text style={styles.providerHint}>
            Deze tegenpartij verwerkt meerdere soorten aankopen. AI let daarom
            extra op de omschrijving per betaling, en bulk-bijwerken op
            tegenpartij wordt niet voorgesteld.
          </Text>
        ) : null}

        {aiState === "idle" || aiState === "error" ? (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, savingCategory && styles.btnDisabled]}
              onPress={() => void handleAiReclassify()}
              disabled={savingCategory}
            >
              <Text style={styles.primaryBtnText}>Herclassificeer via AI</Text>
            </TouchableOpacity>
            {aiState === "error" && aiError ? (
              <Text style={styles.errorText}>{aiError}</Text>
            ) : null}
          </>
        ) : aiState === "loading" ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinColors.green} size="small" />
            <Text style={styles.loadingText}>AI analyseert transactie…</Text>
          </View>
        ) : aiState === "result" && aiSuggestion ? (
          <View style={styles.aiResultCard}>
            {aiSuggestion.isSameAsCurrent ? (
              <>
                <Text style={styles.aiSameText}>
                  ✓ AI bevestigt de huidige categorie
                </Text>
                <Text style={styles.aiCategoryLine}>
                  {aiSuggestion.parentName
                    ? `${aiSuggestion.parentName} › ${aiSuggestion.categoryName}`
                    : aiSuggestion.categoryName}
                </Text>
                <Text style={styles.mutedText}>{aiSuggestion.reason}</Text>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => {
                    setAiState("idle");
                    setAiSuggestion(null);
                  }}
                >
                  <Text style={styles.smallBtnText}>Sluiten</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.mutedText}>Suggestie van AI:</Text>
                <Text style={styles.aiCategoryLine}>
                  {aiSuggestion.parentName
                    ? `${aiSuggestion.parentName} › ${aiSuggestion.categoryName}`
                    : aiSuggestion.categoryName}
                </Text>
                <Text style={styles.aiConf}>
                  {Math.round(aiSuggestion.confidence * 100)}% zekerheid
                </Text>
                <Text style={styles.mutedText}>{aiSuggestion.reason}</Text>
                <View style={styles.aiActions}>
                  {!isSubjectDrivenProvider ? (
                    <TouchableOpacity
                      style={[styles.aiBtn, styles.aiBtnPrimary]}
                      onPress={() => void handleApplyAi(true)}
                      disabled={savingCategory}
                    >
                      <Text style={styles.aiBtnTextPrimary}>
                        Toepassen + regel bijwerken
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.aiBtn}
                    onPress={() => void handleApplyAi(false)}
                    disabled={savingCategory}
                  >
                    <Text style={styles.aiBtnText}>Alleen toepassen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.aiBtn, { opacity: 0.6 }]}
                    onPress={() => {
                      setAiState("idle");
                      setAiSuggestion(null);
                    }}
                    disabled={savingCategory}
                  >
                    <Text style={styles.aiBtnText}>Annuleren</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>

      {/* ── Bulk update ──────────────────────────────────────────────────── */}
      {bulkPhase !== "idle" && tx.counterparty ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Bijwerken:{" "}
            <Text style={styles.counterpartyInline}>{tx.counterparty}</Text>
          </Text>
          {bulkPhase === "confirming" && bulkCounts ? (
            <>
              <Text style={styles.mutedText}>
                Wil je ook andere transacties van deze tegenpartij bijwerken?
              </Text>
              <View style={styles.scopeRow}>
                <TouchableOpacity
                  style={[
                    styles.scopeBtn,
                    bulkScope === "uncategorized" && styles.scopeBtnActive,
                  ]}
                  onPress={() => setBulkScope("uncategorized")}
                >
                  <Text
                    style={[
                      styles.scopeBtnText,
                      bulkScope === "uncategorized" &&
                        styles.scopeBtnTextActive,
                    ]}
                  >
                    Ongecategoriseerde ({bulkCounts.uncategorized})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.scopeBtn,
                    bulkScope === "all" && styles.scopeBtnActive,
                  ]}
                  onPress={() => setBulkScope("all")}
                >
                  <Text
                    style={[
                      styles.scopeBtnText,
                      bulkScope === "all" && styles.scopeBtnTextActive,
                    ]}
                  >
                    Alle ({bulkCounts.all})
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bulkActions}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  onPress={() => void handleBulkUpdate()}
                >
                  <Text style={styles.primaryBtnText}>Bijwerken</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ghostBtn, { flex: 1 }]}
                  onPress={() => setBulkPhase("idle")}
                >
                  <Text style={styles.ghostBtnText}>Overslaan</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : bulkPhase === "updating" ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={FinColors.green} size="small" />
              <Text style={styles.loadingText}>Transacties bijwerken…</Text>
            </View>
          ) : bulkPhase === "done" ? (
            <View style={styles.rowBetween}>
              <Text style={styles.aiSameText}>✓ Transacties bijgewerkt</Text>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => setBulkPhase("idle")}
              >
                <Text style={styles.smallBtnText}>Sluiten</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Counterparty history ─────────────────────────────────────────── */}
      {tx.counterparty ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Andere transacties:{" "}
            <Text style={styles.counterpartyInline}>{tx.counterparty}</Text>
          </Text>
          {history.length === 0 ? (
            <Text style={styles.mutedText}>
              Geen andere transacties gevonden.
            </Text>
          ) : (
            history.map((item) => {
              const categoryLabel = getCategoryPathLabel(item, categoryById);
              const subject = getSubjectFromDetails(item.details);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyItem}
                  onPress={() =>
                    router.push(`/transaction-detail?id=${item.id}`)
                  }
                >
                  <View style={styles.historyIconWrap}>
                    <TransactionCategoryIcon
                      row={item}
                      categoryById={categoryById}
                    />
                  </View>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyDate}>{item.date}</Text>
                    <Text style={styles.historyDesc} numberOfLines={2}>
                      {subject}
                    </Text>
                    <Text style={styles.historyCat}>{categoryLabel}</Text>
                  </View>
                  <Text
                    style={[
                      styles.historyAmount,
                      {
                        color:
                          item.amount < 0 ? FinColors.red : FinColors.green,
                      },
                    ]}
                  >
                    {item.amount < 0 ? "−" : "+"}
                    {euroFormatter.format(Math.abs(item.amount))}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() =>
              router.push(
                `/transactions?counterparty=${encodeURIComponent(tx.counterparty!)}`,
              )
            }
          >
            <Text style={styles.viewAllText}>
              Bekijk alle transacties van {tx.counterparty} →
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: FinColors.bgBase },
  content: { padding: 16, gap: 12 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: FinColors.bgBase,
  },
  emptyText: { color: FinColors.textSecondary, fontSize: 15 },

  // Card
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitle: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  counterpartyInline: {
    textTransform: "none",
    letterSpacing: 0,
    opacity: 1,
    fontWeight: "600",
    fontSize: 12,
  },

  // Header
  counterparty: {
    flex: 1,
    color: FinColors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  reviewedBox: { alignItems: "center", gap: 4 },
  reviewedLabel: {
    color: FinColors.textMuted,
    fontSize: 11,
    textAlign: "center",
  },
  amount: { fontSize: 28, fontWeight: "700" },
  dateText: { color: FinColors.textSecondary, fontSize: 14 },

  // Info rows
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  infoLabel: { color: FinColors.textMuted, fontSize: 13, flex: 1 },
  infoValue: {
    color: FinColors.textPrimary,
    fontSize: 13,
    flex: 2,
    textAlign: "right",
  },

  // Category badges
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  parentBadge: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  categoryBadge: {
    color: FinColors.green,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  sourcePill: { color: FinColors.textMuted, fontSize: 12 },
  mutedText: {
    color: FinColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  // Small button
  smallBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallBtnText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },

  // Category picker
  pickerWrap: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FinColors.border,
    paddingTop: 12,
  },
  pickerGroup: {
    color: FinColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pickerItemActive: { backgroundColor: FinColors.greenBg },
  pickerItemText: { color: FinColors.textPrimary, fontSize: 14 },
  pickerItemTextActive: { color: FinColors.green, fontWeight: "600" },
  checkmark: { color: FinColors.green, fontSize: 16 },

  // Buttons
  primaryBtn: {
    backgroundColor: FinColors.green,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: FinColors.bgBase,
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ghostBtnText: {
    color: FinColors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 6,
  },
  loadingText: { color: FinColors.textSecondary, fontSize: 14 },
  providerHint: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: FinColors.red,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  // AI result
  aiResultCard: {
    backgroundColor: FinColors.bgElevated,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  aiSameText: { color: FinColors.green, fontSize: 14, fontWeight: "600" },
  aiCategoryLine: {
    color: FinColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  aiConf: { color: FinColors.textSecondary, fontSize: 12 },
  aiActions: { gap: 8, marginTop: 4 },
  aiBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  aiBtnPrimary: { backgroundColor: FinColors.green, borderWidth: 0 },
  aiBtnText: { color: FinColors.textPrimary, fontSize: 14, fontWeight: "600" },
  aiBtnTextPrimary: {
    color: FinColors.bgBase,
    fontSize: 14,
    fontWeight: "700",
  },

  // Bulk update
  scopeRow: { flexDirection: "row", gap: 8 },
  scopeBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  scopeBtnActive: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  scopeBtnText: {
    color: FinColors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  scopeBtnTextActive: { color: FinColors.green, fontWeight: "600" },
  bulkActions: { flexDirection: "row", gap: 8 },

  // History
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FinColors.border,
    gap: 10,
  },
  historyIconWrap: {
    marginRight: 2,
  },
  historyLeft: { flex: 1, gap: 3 },
  historyDate: { color: FinColors.textSecondary, fontSize: 13 },
  historyDesc: {
    color: FinColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  historyCat: {
    color: FinColors.textMuted,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 4,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  historyAmount: { fontSize: 15, fontWeight: "600" },
  viewAllBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FinColors.border,
  },
  viewAllText: { color: FinColors.green, fontSize: 14, fontWeight: "600" },
});
