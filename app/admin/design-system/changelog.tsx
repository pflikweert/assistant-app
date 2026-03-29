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
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
import { designSystemHubChangelogEntries, designSystemHubSections } from "@/services/design-system-hub";
import { type Href, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";

function ChangeEntry({
  date,
  title,
  summary,
}: {
  date: string;
  title: string;
  summary: string;
}) {
  return (
    <FinanceDetailCard title={title} subtitle={date} tone="subtle">
      <FinanceText variant="body-sm" tone="secondary">
        {summary}
      </FinanceText>
    </FinanceDetailCard>
  );
}

export default function DesignSystemChangelogScreen() {
  const router = useRouter();

  return (
    <View style={designSystemSharedStyles.pageStack}>
      <DesignSystemPageHero
        eyebrow="Wijzigingen"
        title="Design System changelog"
        subtitle="Compact intern log voor beslissingen die je later snel wilt kunnen terugvinden."
        actions={[
          {
            label: "Bronnen & sync",
            onPress: () => router.push("/admin/design-system/sources" as Href),
          },
          {
            label: "Overzicht",
            onPress: () => router.push("/admin/design-system" as Href),
            variant: "secondary",
          },
        ]}
        statuses={[
          { label: "Intern log", tone: "watch" },
          { label: "Admin-only", tone: "critical" },
          { label: "Bronverwijzend", tone: "good" },
        ]}
      />

      <DesignSystemStatsRow
        items={[
          { label: "Entries", value: `${designSystemHubChangelogEntries.length}` },
          { label: "Secties", value: `${designSystemHubSections.length}` },
          { label: "Logtype", value: "compact" },
          { label: "Doel", value: "Beslissingen terugvinden", tone: "muted" },
        ]}
      />

      <FinanceDetailCard
        title="Gebruik van dit log"
        subtitle="Wat hier wel en niet in hoort"
      >
        <DesignSystemSubtlePanel>
          <FinanceText variant="body-sm" tone="secondary">
            Voeg hier alleen design-systemwijzigingen toe die designers of developers later actief moeten kunnen terugvinden.
          </FinanceText>
        </DesignSystemSubtlePanel>
      </FinanceDetailCard>

      <DesignSystemBlockGrid>
        <FinanceSettingsGroup title="Recente wijzigingen">
          <View style={styles.stack}>
            {designSystemHubChangelogEntries.map((entry) => (
              <ChangeEntry
                key={`${entry.date}-${entry.title}`}
                date={entry.date}
                title={entry.title}
                summary={entry.summary}
              />
            ))}
          </View>
        </FinanceSettingsGroup>

        <FinanceDetailCard title="Template voor een nieuw item" tone="subtle">
          <View style={styles.templateBox}>
            <FinanceText variant="caption" tone="muted">
              datum
            </FinanceText>
            <FinanceText variant="body-sm" tone="secondary">
              2026-03-29
            </FinanceText>
            <FinanceText variant="caption" tone="muted">
              onderdeel
            </FinanceText>
            <FinanceText variant="body-sm" tone="secondary">
              Tokens / componenten / patronen / bronnen
            </FinanceText>
            <FinanceText variant="caption" tone="muted">
              korte wijziging
            </FinanceText>
            <FinanceText variant="body-sm" tone="secondary">
              Wat is aangepast en waarom het relevant is.
            </FinanceText>
            <FinanceText variant="caption" tone="muted">
              bron
            </FinanceText>
            <FinanceText variant="body-sm" tone="secondary">
              Link naar code, doc of Stitch-referentie
            </FinanceText>
          </View>
        </FinanceDetailCard>
      </DesignSystemBlockGrid>

      <FinanceDetailCard title="Onderhoudsregel" tone="subtle">
        <View style={styles.stack}>
          <FinanceText variant="body-sm" tone="secondary">
            Als de hub zelf een bronwijziging signaleert, update dan niet alleen deze lijst maar ook de leidende docs en de Stitch-registratie.
          </FinanceText>
          <FinanceSettingsRow
            label="Code + docs sync"
            subtitle="Eerst bronbestanden updaten, daarna changelog."
            value="verplicht"
          />
        </View>
      </FinanceDetailCard>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: FinSpacing.x2,
  },
  templateBox: {
    gap: FinSpacing.x1,
    padding: FinSpacing.m,
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
});
