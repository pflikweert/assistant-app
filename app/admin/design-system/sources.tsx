import {
  DesignSystemBlockGrid,
  DesignSystemPageHero,
  DesignSystemStatsRow,
  DesignSystemSubtlePanel,
} from "@/components/admin/design-system-page-kit";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceSettingsRow } from "@/components/ui/finance-settings-row";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing, Fonts } from "@/constants/theme";
import {
  designSystemHubChangeChecklist,
  designSystemHubDesignChangeNotes,
  designSystemHubFlowCoverage,
  designSystemHubLeadFiles,
  designSystemHubMeta,
  designSystemHubSources,
  designSystemHubSyncCommands,
} from "@/services/design-system-hub";
import { type Href, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";

const MONO_FALLBACK =
  "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

function CodeBlock({
  lines,
}: {
  lines: string[];
}) {
  return (
    <View style={styles.codeBlock}>
      {lines.map((line) => (
        <Text key={line} style={styles.codeLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export default function DesignSystemSourcesScreen() {
  const router = useRouter();

  return (
    <View style={designSystemSharedStyles.pageStack}>
      <DesignSystemPageHero
        eyebrow="Bronnen en sync"
        title="Leidende bestanden en onderhoudsflow"
        subtitle="De hub is een routekaart. De waarheid blijft in code en docs. Gebruik dit om snel te zien wat je mee moet bewegen."
        actions={[
          {
            label: "Tokens",
            onPress: () => router.push("/admin/design-system/tokens" as Href),
          },
          {
            label: "Wijzigingen",
            onPress: () => router.push("/admin/design-system/changelog" as Href),
            variant: "secondary",
          },
        ]}
        statuses={[
          { label: "Stitch gekoppeld", tone: "good" },
          { label: "Admin-only", tone: "critical" },
          { label: "Sync verplicht", tone: "watch" },
        ]}
      />

      <DesignSystemStatsRow
        items={[
          { label: "Leidende files", value: `${designSystemHubLeadFiles.length}` },
          { label: "Sync checks", value: `${designSystemHubSyncCommands.length}` },
          { label: "Wijzig-checklist", value: `${designSystemHubChangeChecklist.length}` },
          { label: "Canonical asset", value: `v${designSystemHubMeta.canonicalAssetVersion}` },
        ]}
      />

      <FinanceDetailCard
        title="Broncontract"
        subtitle="Waarom deze pagina bestaat"
      >
        <DesignSystemSubtlePanel>
          {designSystemHubSources.map((item) => (
            <FinanceText key={item.label} variant="body-sm" tone="secondary">
              • {item.label}: {item.detail}
            </FinanceText>
          ))}
        </DesignSystemSubtlePanel>
      </FinanceDetailCard>

      <DesignSystemBlockGrid>
        <FinanceSettingsGroup title="Leidende files">
          <View style={styles.stack}>
            {designSystemHubLeadFiles.map((file) => (
              <FinanceSettingsRow
                key={file.path}
                label={file.label}
                subtitle={`${file.detail} · ${file.path}`}
                value="leidend"
              />
            ))}
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Stitch referentie">
          <FinanceSettingsRow
            label="Project"
            subtitle={`${designSystemHubMeta.stitchProjectName} · ${designSystemHubMeta.stitchProjectId}`}
            value="project"
          />
          <FinanceSettingsRow
            label="Canonical asset"
            subtitle={`${designSystemHubMeta.canonicalAssetDisplayName} · ${designSystemHubMeta.canonicalAssetId}`}
            value={`v${designSystemHubMeta.canonicalAssetVersion}`}
          />
          <FinanceSettingsRow
            label="Context"
            subtitle="Stitch en repo-docs moeten samen blijven bewegen."
            value={designSystemHubMeta.sourceOfTruth}
          />
        </FinanceSettingsGroup>
      </DesignSystemBlockGrid>

      <DesignSystemBlockGrid>
        <FinanceSettingsGroup title="Als je design wijzigt, werk ook dit bij">
          <View style={styles.stack}>
            {designSystemHubChangeChecklist.map((item) => (
              <FinanceDetailCard key={item.label} title={item.label} tone="subtle">
                <FinanceText variant="body-sm" tone="secondary">
                  {item.detail}
                </FinanceText>
              </FinanceDetailCard>
            ))}
          </View>
        </FinanceSettingsGroup>

        <FinanceDetailCard
          title="Onderhoudsflow"
          subtitle="Houd dit kort en herhaalbaar."
        >
          <View style={styles.stack}>
            {designSystemHubDesignChangeNotes.map((step, index) => (
              <FinanceText key={step} variant="body-sm" tone="secondary">
                {index + 1}. {step}
              </FinanceText>
            ))}
          </View>
        </FinanceDetailCard>
      </DesignSystemBlockGrid>

      <FinanceSettingsGroup title="Sync-preflight">
        <DesignSystemSubtlePanel>
          <CodeBlock lines={Array.from(designSystemHubSyncCommands)} />
          <FinanceText variant="caption" tone="muted">
            Gebruik deze commando&apos;s alleen als je echt de Stitch-bron wilt controleren of actualiseren.
          </FinanceText>
        </DesignSystemSubtlePanel>
      </FinanceSettingsGroup>
      <FinanceDetailCard title="Snelle broncontrole" tone="subtle">
        <View style={styles.stack}>
          <FinanceSettingsRow
            label="Code eerst"
            subtitle="Token- en componentwijzigingen landen eerst in code."
            value="stap 1"
          />
          <FinanceSettingsRow
            label="Docs daarna"
            subtitle="Houd UI-patterns en inventories synchroon."
            value="stap 2"
          />
          <FinanceSettingsRow
            label="Hub als referentie"
            subtitle="Werk de hub bij na code/docs bevestiging."
            value="stap 3"
          />
        </View>
      </FinanceDetailCard>

      <FinanceSettingsGroup title="Flowbronnen die vaak vergeten worden">
        <View style={styles.stack}>
          {designSystemHubFlowCoverage.map((flow) => (
            <FinanceDetailCard
              key={`flow-source-${flow.area}`}
              title={flow.area}
              subtitle={flow.routes.join(" · ")}
              tone="subtle"
            >
              <View style={styles.stack}>
                {flow.sourceFocus.map((source) => (
                  <FinanceText key={`${flow.area}-${source}`} variant="body-sm" tone="secondary">
                    • {source}
                  </FinanceText>
                ))}
                <FinanceText variant="caption" tone="muted">
                  Componentfocus: {flow.componentFocus.join(" · ")}
                </FinanceText>
              </View>
            </FinanceDetailCard>
          ))}
        </View>
      </FinanceSettingsGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: FinSpacing.x2,
  },
  codeBlock: {
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: FinSpacing.m,
    gap: FinSpacing.x1,
  },
  codeLine: {
    color: FinColors.textPrimary,
    fontFamily: Fonts?.mono ?? MONO_FALLBACK,
    fontSize: 13,
    lineHeight: 18,
  },
});
