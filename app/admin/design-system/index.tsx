import {
  DesignSystemBlockGrid,
  DesignSystemPageHero,
  DesignSystemStatsRow,
} from "@/components/admin/design-system-page-kit";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceSettingsRow } from "@/components/ui/finance-settings-row";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinSpacing } from "@/constants/theme";
import {
  designSystemHubMeta,
  designSystemHubSections,
} from "@/services/design-system-hub";
import { useRouter, type Href } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";

function BulletList({
  items,
}: {
  items: string[];
}) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <FinanceText variant="body-sm" tone="secondary">
            {item}
          </FinanceText>
        </View>
      ))}
    </View>
  );
}

export default function DesignSystemOverviewScreen() {
  const router = useRouter();
  const quickLinks = designSystemHubSections.filter((section) => section.id !== "overview");

  return (
    <View style={designSystemSharedStyles.pageStack}>
      <DesignSystemPageHero
        eyebrow="Design system hub"
        title="Overzicht en governance"
        subtitle="Interne referentie voor designers en developers. Deze pagina is een wegwijzer naar de echte bronnen in code en docs."
        actions={[
          {
            label: "Tokens bekijken",
            onPress: () => router.push("/admin/design-system/tokens" as Href),
          },
          {
            label: "Bronnen & sync",
            onPress: () => router.push("/admin/design-system/sources" as Href),
            variant: "secondary",
          },
        ]}
        statuses={[
          { label: "Admin-only", tone: "critical" },
          { label: "Code + docs", tone: "good" },
          { label: "Utility", tone: "watch" },
        ]}
      />

      <DesignSystemStatsRow
        items={[
          { label: "Secties", value: `${designSystemHubSections.length}` },
          { label: "Project", value: "Stitch v2026" },
          { label: "Canonical asset", value: `v${designSystemHubMeta.canonicalAssetVersion}` },
          { label: "Waarheid", value: "Codebase + docs", tone: "muted" },
        ]}
      />

      <DesignSystemBlockGrid>
        <FinanceDetailCard
          title="Bron van waarheid"
          subtitle="Wat leidend is"
          rightSlot={
            <FinanceText variant="caption" tone="muted">
              intern contract
            </FinanceText>
          }
        >
          <BulletList
            items={[
              "Gebruik deze hub om snel het actuele Budio Design System terug te vinden.",
              "Bron van waarheid blijft de codebase en de repo-docs.",
              "De hub standaardiseert beslissingen, maar vervangt geen bronbestand.",
            ]}
          />
        </FinanceDetailCard>

        <FinanceDetailCard
          title="Leidende bronnen"
          subtitle="Stitch + code + docs"
          rightSlot={
            <FinanceText variant="caption" tone="muted">
              snel overzicht
            </FinanceText>
          }
        >
          <FinanceSettingsGroup title="Kern">
            <FinanceSettingsRow
              label="Stitch project"
              subtitle={`${designSystemHubMeta.stitchProjectName} · ${designSystemHubMeta.stitchProjectId}`}
              value="project"
            />
            <FinanceSettingsRow
              label="Canonical asset"
              subtitle={`${designSystemHubMeta.canonicalAssetDisplayName} · ${designSystemHubMeta.canonicalAssetId}`}
              value={`v${designSystemHubMeta.canonicalAssetVersion}`}
            />
            <FinanceSettingsRow
              label="Runtime bron"
              subtitle="Codebase + repo-docs"
              value={designSystemHubMeta.runtimeSurface}
            />
          </FinanceSettingsGroup>
        </FinanceDetailCard>

        <FinanceDetailCard
          title="Gebruik in de praktijk"
          subtitle="Werkwijze voor design + dev"
          rightSlot={<FinanceText variant="caption" tone="muted">do</FinanceText>}
        >
          <BulletList
            items={[
              "Check eerst live token- en componentbron voordat je een nieuwe variant maakt.",
              "Gebruik de patronenpagina voor shell-, modal- en utilitykeuzes.",
              "Werk Stitch en docs bij wanneer de hub een bronverschuiving laat zien.",
            ]}
          />
        </FinanceDetailCard>

        <FinanceDetailCard
          title="Wat niet mag"
          subtitle="Bescherm de bestaande designrichting"
          rightSlot={<FinanceText variant="caption" tone="muted">don&apos;t</FinanceText>}
        >
          <BulletList
            items={[
              "Geen nieuwe kleurtaal, spacingtaal of componenttaal introduceren.",
              "Geen nieuwe waarheid maken in de hub zelf.",
              "Geen admin-pagina laten uitgroeien tot losse design language.",
            ]}
          />
        </FinanceDetailCard>
      </DesignSystemBlockGrid>

      <FinanceSettingsGroup title="Quick links">
        {quickLinks.map((section) => (
          <FinanceSettingsRow
            key={section.id}
            label={section.label}
            subtitle={section.description}
            onPress={() => router.push(section.href as Href)}
          />
        ))}
      </FinanceSettingsGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  bulletList: {
    gap: FinSpacing.x2,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: FinSpacing.x2,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: FinColors.warningText,
    marginTop: 8,
  },
});
