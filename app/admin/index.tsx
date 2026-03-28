import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinanceAdminShell } from "@/components/ui/finance-admin-shell";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceSectionHeader } from "@/components/ui/finance-section-header";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { fetchAdminBootstrap } from "@/services/admin-api";
import { useAdminAccess } from "@/services/admin-access";
import {
  updateAiReviewItemStatus,
  type AiReviewInboxItem,
} from "@/services/ai-review-inbox";
import {
  updateAiRouteSetting,
  type UpdateAiRouteSettingInput,
} from "@/services/ai-route-settings";
import {
  formatAiUsageCount,
  formatOpenAiCost,
  refreshAiUsageOverview,
  type AiUsageOverview,
} from "@/services/ai-usage";
import {
  getAiUseCaseDefinition,
  listAiUseCases,
  type AiRouteSetting,
} from "@/services/ai-use-cases";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type AdminBootstrap = {
  profile: {
    userId: string;
    role: string;
    email: string | null;
  } | null;
  routeSettings: AiRouteSetting[];
  usageOverview: AiUsageOverview;
  reviewItems: AiReviewInboxItem[];
};

const REVIEW_REASON_LABELS: Record<string, string> = {
  low_confidence: "Lage zekerheid",
  repeated_question: "Vraag herhaald",
  fallback_used: "Fallback gebruikt",
  parse_error: "Antwoord niet leesbaar",
  ai_error: "AI-fout",
  issue_flow_incomplete: "Flow niet afgerond",
  not_helped: "Niet geholpen",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  nieuw: "Nieuw",
  bekeken: "Bekeken",
  opgelost: "Opgelost",
};

const ROUTE_MODE_LABELS: Record<string, string> = {
  text: "Tekst",
  json_object: "JSON",
  json_schema: "Schema",
};

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "Onbekend";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Onbekend";
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReviewReasonLabel(value: string) {
  return REVIEW_REASON_LABELS[value] || value;
}

function getReviewStatusLabel(value: string) {
  return REVIEW_STATUS_LABELS[value] || value;
}

function StatCard({
  label,
  value,
  subtitle,
  iconName,
}: {
  label: string;
  value: string;
  subtitle?: string;
  iconName: AppIconName;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <AppIcon
          name={iconName}
          size={18}
          color={FinColors.textPrimary}
          variant="outlined"
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "watch" | "critical";
}) {
  const toneStyle =
    tone === "good"
      ? styles.pillGood
      : tone === "watch"
        ? styles.pillWatch
        : tone === "critical"
          ? styles.pillCritical
          : styles.pillNeutral;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionWrap}>
      <FinanceSectionHeader title={title} subtitle={subtitle} />
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const access = useAdminAccess();
  const [bootstrap, setBootstrap] = React.useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [savingReviewId, setSavingReviewId] = React.useState<string | null>(null);
  const [savingRouteId, setSavingRouteId] = React.useState<string | null>(null);
  const [refreshingUsage, setRefreshingUsage] = React.useState(false);
  const [usageLastRefreshedAt, setUsageLastRefreshedAt] = React.useState<string | null>(null);
  const [selectedReviewItem, setSelectedReviewItem] = React.useState<AiReviewInboxItem | null>(null);
  const [selectedRouteSetting, setSelectedRouteSetting] = React.useState<AiRouteSetting | null>(null);
  const [editModel, setEditModel] = React.useState("");
  const [editAgentMode, setEditAgentMode] = React.useState("");
  const [editTemp, setEditTemp] = React.useState("");
  const [editMaxTokens, setEditMaxTokens] = React.useState("");
  const [editFallbackEnabled, setEditFallbackEnabled] = React.useState(true);
  const [editResponseMode, setEditResponseMode] = React.useState("text");

  const loadBootstrap = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBootstrap<AdminBootstrap>();
      setBootstrap(data);
    } catch (error) {
      console.warn("[admin] bootstrap load failed", error);
      setBootstrap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (access.loading) return;
    if (!access.isAdmin) {
      router.replace("/settings" as Href);
      return;
    }
    void loadBootstrap();
  }, [access.isAdmin, access.loading, loadBootstrap, router]);

  const usage = bootstrap?.usageOverview;
  const reviewItems = React.useMemo(
    () => bootstrap?.reviewItems ?? [],
    [bootstrap?.reviewItems],
  );
  const routeSettings = bootstrap?.routeSettings || [];
  const openAiUsageUnavailable = Boolean(usage && usage.openAiCostMonth == null);
  const aiTelemetryEmpty =
    (usage?.aiCallsMonth || 0) === 0 && (usage?.useCaseRows || []).every((row) => row.calls === 0);
  const usageSourceLabel = openAiUsageUnavailable ? "Budio-telemetrie" : "Live OpenAI";

  const reviewCounts = React.useMemo(() => {
    const counts = { nieuw: 0, bekeken: 0, opgelost: 0 };
    for (const item of reviewItems) {
      if (item.status === "bekeken") counts.bekeken += 1;
      else if (item.status === "opgelost") counts.opgelost += 1;
      else counts.nieuw += 1;
    }
    return counts;
  }, [reviewItems]);

  const openReviewItem = (item: AiReviewInboxItem) => {
    setSelectedReviewItem(item);
  };

  const openRouteSetting = (setting: AiRouteSetting) => {
    setSelectedRouteSetting(setting);
    setEditModel(setting.model || "");
    setEditAgentMode(setting.agent_mode || "");
    setEditTemp(String(setting.temperature ?? ""));
    setEditMaxTokens(String(setting.max_tokens ?? ""));
    setEditFallbackEnabled(Boolean(setting.fallback_enabled));
    setEditResponseMode(setting.response_mode || "text");
  };

  const handleReviewStatusChange = async (id: string, status: "nieuw" | "bekeken" | "opgelost") => {
    if (savingReviewId) return;
    setSavingReviewId(id);
    try {
      await updateAiReviewItemStatus(id, status);
      await loadBootstrap();
    } catch (error) {
      console.warn("[admin] review update failed", error);
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleUsageRefresh = async () => {
    if (refreshingUsage) return;
    setRefreshingUsage(true);
    try {
      const response = await refreshAiUsageOverview();
      setBootstrap((current) =>
        current
          ? {
              ...current,
              usageOverview: response.usageOverview,
            }
          : current,
      );
      setUsageLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      console.warn("[admin] usage refresh failed", error);
      await loadBootstrap();
    } finally {
      setRefreshingUsage(false);
    }
  };

  const handleRouteSave = async () => {
    if (!selectedRouteSetting || savingRouteId) return;
    setSavingRouteId(selectedRouteSetting.use_case);
    try {
      const payload: UpdateAiRouteSettingInput = {
        use_case: selectedRouteSetting.use_case,
        model: editModel.trim() || selectedRouteSetting.model,
        agent_mode: editAgentMode.trim() || selectedRouteSetting.agent_mode,
        temperature: Number.isFinite(Number(editTemp))
          ? Number(editTemp)
          : selectedRouteSetting.temperature,
        max_tokens: Number.isFinite(Number(editMaxTokens))
          ? Number(editMaxTokens)
          : selectedRouteSetting.max_tokens,
        fallback_enabled: editFallbackEnabled,
        response_mode: editResponseMode as "text" | "json_object" | "json_schema",
      };
      await updateAiRouteSetting(payload);
      setSelectedRouteSetting(null);
      await loadBootstrap();
    } catch (error) {
      console.warn("[admin] route setting save failed", error);
    } finally {
      setSavingRouteId(null);
    }
  };

  if (access.loading || loading) {
    return (
      <FinanceAdminShell
        title="Budio beheer"
        subtitle="Compacte beheeromgeving voor AI-inzicht, review en route-instellingen."
        onBack={() => router.back()}
      >
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={FinColors.green} />
          <Text style={styles.loadingText}>Budio beheer wordt geladen…</Text>
        </View>
      </FinanceAdminShell>
    );
  }

  return (
    <>
      <FinanceAdminShell
        title="Budio beheer"
        subtitle="Compacte beheeromgeving voor AI-inzicht, review en route-instellingen."
        onBack={() => router.back()}
        contentContainerStyle={styles.scroll}
      >
        <FinanceHeroShell
          eyebrow="Beheer"
          title="Budio beheer"
          subtitle="Overzicht van assistentfrictie, AI-verbruik en de route-instellingen die de proxy gebruikt."
          shellStyle={styles.heroShell}
          titleStyle={styles.heroTitle}
          subtitleStyle={styles.heroSubtitle}
        >
          <View style={styles.heroPills}>
            <Pill label={`${reviewCounts.nieuw} nieuw`} tone="watch" />
            <Pill label={`${reviewCounts.bekeken} bekeken`} />
            <Pill label={`${reviewCounts.opgelost} opgelost`} tone="good" />
          </View>
        </FinanceHeroShell>

        <View style={styles.contentMax}>
          <SectionCard
            title="Assistent review"
            subtitle="Items waar de assistent waarschijnlijk niet voldoende heeft geholpen of waar productfrictie zichtbaar is."
          >
            <View style={styles.statGrid}>
              <StatCard
                iconName="mark-email-unread"
                label="Nieuw"
                value={String(reviewCounts.nieuw)}
                subtitle="Nog niet bekeken"
              />
              <StatCard
                iconName="visibility"
                label="Bekeken"
                value={String(reviewCounts.bekeken)}
                subtitle="Wel gezien, nog open"
              />
              <StatCard
                iconName="check-circle-outline"
                label="Opgelost"
                value={String(reviewCounts.opgelost)}
                subtitle="Afgehandeld"
              />
            </View>

            <View style={styles.listBlock}>
              {reviewItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Nog geen review-items</Text>
                  <Text style={styles.emptyText}>
                    Zodra de assistent een fallback gebruikt, een lage zekerheid heeft of een fout maakt, verschijnt hier een overzichtelijk review-item.
                  </Text>
                </View>
              ) : (
                reviewItems.slice(0, 6).map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.listRow,
                      pressed && styles.listRowPressed,
                    ]}
                    onPress={() => openReviewItem(item)}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{item.summary}</Text>
                      <Text style={styles.rowMeta}>
                        {getReviewReasonLabel(item.reason_type)} · {item.screen_title || item.route_name || "Onbekend scherm"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        Laatst gezien: {formatShortDateTime(item.last_seen_at)}
                      </Text>
                    </View>
                    <View style={styles.rowSide}>
                      <Pill label={getReviewStatusLabel(item.status)} tone={item.status === "opgelost" ? "good" : item.status === "bekeken" ? "neutral" : "watch"} />
                      <AppIcon
                        name="chevron-right"
                        size={18}
                        color={FinColors.textMuted}
                        variant="outlined"
                      />
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </SectionCard>

          <SectionCard
            title="AI verbruik"
            subtitle="Totaal gebruik vandaag en deze maand, plus verdeling per use case."
          >
            <View style={styles.sectionActionRow}>
              <Text style={styles.sectionActionHint}>
                Meest recente totalen ophalen uit OpenAI en de 10-minuten cache leegmaken.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.sectionActionButton,
                  pressed && styles.sectionActionButtonPressed,
                  refreshingUsage && styles.sectionActionButtonDisabled,
                ]}
                onPress={handleUsageRefresh}
                disabled={refreshingUsage}
              >
                {refreshingUsage ? (
                  <ActivityIndicator size="small" color={FinColors.textPrimary} />
                ) : (
                  <Text style={styles.sectionActionButtonText}>Vernieuwen</Text>
                )}
              </Pressable>
            </View>
            <View style={styles.usageSourceRow}>
              <Pill
                label={`${usageSourceLabel} actief`}
                tone={openAiUsageUnavailable ? "watch" : "good"}
              />
              <Pill
                label={usage?.usageFetchedAt ? "Recent opgehaald" : "Nog niet opgehaald"}
                tone={usage?.usageFetchedAt ? "good" : "neutral"}
              />
            </View>
            <Text style={styles.usageFreshness}>
              {usageLastRefreshedAt || usage?.usageFetchedAt
                ? `Laatst ververst: ${formatShortDateTime(usageLastRefreshedAt || usage?.usageFetchedAt)}`
                : "Nog niet ververst"}
            </Text>
            <View style={styles.statGrid}>
              <StatCard
                iconName="timer"
                label="Tokens vandaag"
                value={formatAiUsageCount(usage?.totalTokensToday || 0)}
                subtitle="Totaal verbruik vandaag"
              />
              <StatCard
                iconName="calendar-month"
                label="Tokens deze maand"
                value={formatAiUsageCount(usage?.totalTokensMonth || 0)}
                subtitle="Totaal verbruik deze maand"
              />
              <StatCard
                iconName="psychology"
                label="AI-calls"
                value={formatAiUsageCount(usage?.aiCallsMonth || 0)}
                subtitle="Deze maand"
              />
              <StatCard
                iconName="savings"
                label="OpenAI kosten"
                value={formatOpenAiCost(
                  usage?.openAiCostMonth ?? null,
                  usage?.openAiCostCurrency ?? null,
                )}
                subtitle="Live via OpenAI, 10 min cache"
              />
            </View>

            <Text style={styles.usageNote}>
              De use case-verdeling hieronder komt uit Budio-telemetrie. De totalen en kosten bovenaan worden live uit OpenAI gehaald wanneer de admin key beschikbaar is.
            </Text>
            {openAiUsageUnavailable ? (
              <View style={styles.usageAlert}>
                <Text style={styles.usageAlertTitle}>Live OpenAI-totalen niet beschikbaar</Text>
                <Text style={styles.usageAlertText}>
                  Deze key kan de organisatie-usage niet uitlezen of levert nog geen bruikbare data. We tonen daarom de Budio-telemetrie en totale kosten uit de eigen logging.
                </Text>
              </View>
            ) : null}
            {aiTelemetryEmpty ? (
              <View style={styles.usageAlert}>
                <Text style={styles.usageAlertTitle}>Nog geen AI-gebruik gelogd</Text>
                <Text style={styles.usageAlertText}>
                  Zodra de assistent, budgetcoach, categorisatie of PDF-import een AI-call maakt, verschijnen hier de gebruikstotalen per use case.
                </Text>
              </View>
            ) : null}

            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderTitle}>Per use case</Text>
                <Text style={styles.tableHeaderMeta}>
                  {formatAiUsageCount(usage?.errorsMonth || 0)} fouten · {formatAiUsageCount(usage?.fallbackMonth || 0)} fallback
                </Text>
              </View>
              {(usage?.useCaseRows || listAiUseCases().map((definition) => ({
                use_case: definition.key,
                model: "gpt-4.1-mini",
                calls: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                errors: 0,
                fallback_count: 0,
                estimated_cost_eur: 0,
              }))).map((row) => (
                <View key={row.use_case} style={styles.useCaseRow}>
                  <View style={styles.useCaseLeft}>
                    <Text style={styles.useCaseName}>
                      {getAiUseCaseDefinition(row.use_case).label}
                    </Text>
                    <Text style={styles.useCaseSub}>
                      {row.model}
                    </Text>
                  </View>
                  <View style={styles.useCaseRight}>
                    <Text style={styles.useCaseValue}>
                      {formatAiUsageCount(row.calls)} calls
                    </Text>
                    <Text style={styles.useCaseValue}>
                      {formatAiUsageCount(row.total_tokens)} tokens
                    </Text>
                    <Text style={styles.useCaseValue}>
                      {formatAiUsageCount(row.errors)} fouten
                    </Text>
                    <Text style={styles.useCaseValue}>
                      {formatAiUsageCount(row.fallback_count)} fallback
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>AI-ruimte</Text>
              <Text style={styles.infoText}>
                Dit wordt later een intern Budio-concept voor een budgetlimiet of resterende ruimte. In deze eerste versie is dit nog niet ingesteld.
              </Text>
            </View>
          </SectionCard>

          <SectionCard
            title="AI instellingen"
            subtitle="Per use case kun je hier model, agent mode en outputvorm compact bijstellen."
          >
            <View style={styles.listBlock}>
              {routeSettings.map((setting) => {
                const definition = getAiUseCaseDefinition(setting.use_case);
                return (
                  <Pressable
                    key={setting.use_case}
                    style={({ pressed }) => [
                      styles.listRow,
                      pressed && styles.listRowPressed,
                    ]}
                    onPress={() => openRouteSetting(setting)}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{definition.label}</Text>
                      <Text style={styles.rowMeta}>
                        {setting.model} · {setting.agent_mode} · {ROUTE_MODE_LABELS[setting.response_mode] || setting.response_mode}
                      </Text>
                      <Text style={styles.rowMeta}>
                        Temp {String(setting.temperature)} · Max tokens {String(setting.max_tokens)}
                      </Text>
                    </View>
                    <View style={styles.rowSide}>
                      <Pill
                        label={setting.fallback_enabled ? "Fallback aan" : "Fallback uit"}
                        tone={setting.fallback_enabled ? "good" : "neutral"}
                      />
                      <AppIcon
                        name="tune"
                        size={18}
                        color={FinColors.textMuted}
                        variant="outlined"
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        </View>
      </FinanceAdminShell>

      <FinanceBottomSheetShell
        visible={Boolean(selectedReviewItem)}
        title={selectedReviewItem?.summary || "Review-item"}
        subtitle={
          selectedReviewItem
            ? `${getReviewReasonLabel(selectedReviewItem.reason_type)} · ${selectedReviewItem.screen_title || selectedReviewItem.route_name || "Onbekend scherm"}`
            : undefined
        }
        onClose={() => setSelectedReviewItem(null)}
      >
        {selectedReviewItem ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetMetaRow}>
              <Pill label={getReviewStatusLabel(selectedReviewItem.status)} tone={selectedReviewItem.status === "opgelost" ? "good" : selectedReviewItem.status === "bekeken" ? "neutral" : "watch"} />
              <Text style={styles.sheetMetaText}>
                Aantal keer gezien: {formatAiUsageCount(selectedReviewItem.occurrence_count)}
              </Text>
            </View>
            <Text style={styles.sheetText}>
              {selectedReviewItem.detail || "Geen extra detail beschikbaar."}
            </Text>
            <View style={styles.sheetExcerptCard}>
              <Text style={styles.sheetExcerptTitle}>Compact gespreksoverzicht</Text>
              <Text style={styles.sheetExcerptText}>
                {JSON.stringify(selectedReviewItem.conversation_excerpt || {}, null, 2)}
              </Text>
            </View>
            <View style={styles.sheetActionRow}>
              <Pressable
                style={styles.sheetAction}
                onPress={() => handleReviewStatusChange(selectedReviewItem.id, "nieuw")}
                disabled={savingReviewId === selectedReviewItem.id}
              >
                <Text style={styles.sheetActionText}>Nieuw</Text>
              </Pressable>
              <Pressable
                style={styles.sheetAction}
                onPress={() => handleReviewStatusChange(selectedReviewItem.id, "bekeken")}
                disabled={savingReviewId === selectedReviewItem.id}
              >
                <Text style={styles.sheetActionText}>Bekeken</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetAction, styles.sheetActionPrimary]}
                onPress={() => handleReviewStatusChange(selectedReviewItem.id, "opgelost")}
                disabled={savingReviewId === selectedReviewItem.id}
              >
                {savingReviewId === selectedReviewItem.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.sheetActionTextPrimary}>Opgelost</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </FinanceBottomSheetShell>

      <FinanceBottomSheetShell
        visible={Boolean(selectedRouteSetting)}
        title={selectedRouteSetting ? getAiUseCaseDefinition(selectedRouteSetting.use_case).label : "AI-instelling"}
        subtitle="Pas de route-instelling voor deze use case aan."
        onClose={() => setSelectedRouteSetting(null)}
        footer={
          <View style={styles.sheetFooterRow}>
            <Pressable
              style={styles.sheetFooterSecondary}
              onPress={() => setSelectedRouteSetting(null)}
            >
              <Text style={styles.sheetFooterSecondaryText}>Annuleren</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetFooterPrimary, savingRouteId === selectedRouteSetting?.use_case && styles.sheetFooterPrimaryDisabled]}
              onPress={handleRouteSave}
              disabled={savingRouteId === selectedRouteSetting?.use_case}
            >
              {savingRouteId === selectedRouteSetting?.use_case ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.sheetFooterPrimaryText}>Opslaan</Text>
              )}
            </Pressable>
          </View>
        }
      >
        {selectedRouteSetting ? (
          <View style={styles.sheetBody}>
            <Text style={styles.fieldLabel}>Model</Text>
            <TextInput
              value={editModel}
              onChangeText={setEditModel}
              style={styles.input}
              placeholder="gpt-4.1-mini"
              placeholderTextColor={FinColors.textMuted}
            />

            <Text style={styles.fieldLabel}>Agent mode</Text>
            <TextInput
              value={editAgentMode}
              onChangeText={setEditAgentMode}
              style={styles.input}
              placeholder="analysis"
              placeholderTextColor={FinColors.textMuted}
            />

            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>Temperature</Text>
                <TextInput
                  value={editTemp}
                  onChangeText={setEditTemp}
                  style={styles.input}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>Max tokens</Text>
                <TextInput
                  value={editMaxTokens}
                  onChangeText={setEditMaxTokens}
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.fieldLabel}>Fallback enabled</Text>
                <Text style={styles.toggleHint}>
                  Laat de proxy veilig terugvallen als de AI-route faalt.
                </Text>
              </View>
              <Switch
                value={editFallbackEnabled}
                onValueChange={setEditFallbackEnabled}
              />
            </View>

            <Text style={styles.fieldLabel}>Response mode</Text>
            <View style={styles.modeRow}>
              {(["text", "json_object", "json_schema"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={[
                    styles.modeChip,
                    editResponseMode === mode && styles.modeChipActive,
                  ]}
                  onPress={() => setEditResponseMode(mode)}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      editResponseMode === mode && styles.modeChipTextActive,
                    ]}
                  >
                    {ROUTE_MODE_LABELS[mode]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </FinanceBottomSheetShell>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    alignItems: "center",
    gap: 14,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: FinColors.textSecondary,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 170,
  },
  heroShell: {
    backgroundColor: FinColors.bgElevated,
    marginHorizontal: -16,
  },
  heroTitle: {
    fontSize: 44,
    lineHeight: 46,
  },
  heroSubtitle: {
    maxWidth: 760,
    fontSize: 16,
    lineHeight: 24,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
  },
  sectionWrap: {
    marginTop: 18,
  },
  card: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },
  sectionActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionActionHint: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  sectionActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.14)",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionActionButtonPressed: {
    opacity: 0.88,
  },
  sectionActionButtonDisabled: {
    opacity: 0.6,
  },
  sectionActionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  usageSourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flexBasis: "48%",
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "#f7f8f9",
    padding: 16,
    gap: 6,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242,201,76,0.18)",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  statSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  listBlock: {
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f7f8f9",
  },
  listRowPressed: {
    opacity: 0.88,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowSide: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  emptyState: {
    paddingVertical: 10,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  tableCard: {
    borderRadius: 18,
    backgroundColor: "#f7f8f9",
    padding: 16,
    gap: 12,
  },
  usageNote: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  usageAlert: {
    borderRadius: 18,
    backgroundColor: "#fff7e6",
    padding: 14,
    gap: 6,
  },
  usageAlertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  usageAlertText: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  usageFreshness: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textMuted,
  },
  infoCard: {
    borderRadius: 18,
    backgroundColor: "#f7f8f9",
    padding: 16,
    gap: 6,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  tableHeader: {
    gap: 2,
  },
  tableHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  tableHeaderMeta: {
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  useCaseRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(17,17,17,0.06)",
    gap: 6,
  },
  useCaseLeft: {
    gap: 2,
  },
  useCaseName: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  useCaseSub: {
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  useCaseRight: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  useCaseValue: {
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f7f8f9",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  pillNeutral: {
    backgroundColor: "#f7f8f9",
  },
  pillGood: {
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  pillWatch: {
    backgroundColor: "rgba(242,201,76,0.18)",
  },
  pillCritical: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  sheetBody: {
    gap: 14,
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  sheetMetaText: {
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  sheetText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textPrimary,
  },
  sheetExcerptCard: {
    borderRadius: 18,
    backgroundColor: "#f7f8f9",
    padding: 14,
    gap: 8,
  },
  sheetExcerptTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  sheetExcerptText: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontFamily: "monospace",
  },
  sheetActionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  sheetAction: {
    flexGrow: 1,
    minWidth: 84,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#eff1f2",
    alignItems: "center",
  },
  sheetActionPrimary: {
    backgroundColor: FinColors.green,
  },
  sheetActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  sheetActionTextPrimary: {
    fontSize: 13,
    fontWeight: "800",
    color: "white",
  },
  sheetFooterRow: {
    flexDirection: "row",
    gap: 10,
  },
  sheetFooterSecondary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#eff1f2",
  },
  sheetFooterSecondaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  sheetFooterPrimary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: FinColors.green,
  },
  sheetFooterPrimaryDisabled: {
    opacity: 0.7,
  },
  sheetFooterPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "white",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  input: {
    borderRadius: 14,
    backgroundColor: "#f7f8f9",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: FinColors.textPrimary,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputCol: {
    flex: 1,
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  toggleHint: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f7f8f9",
  },
  modeChipActive: {
    backgroundColor: "rgba(242,201,76,0.22)",
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: FinColors.textSecondary,
  },
  modeChipTextActive: {
    color: FinColors.textPrimary,
  },
});
