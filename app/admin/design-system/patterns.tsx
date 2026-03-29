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
import { FinColors, FinSpacing } from "@/constants/theme";
import {
  designSystemHubFlowCoverage,
  designSystemHubPatternBlocks,
  designSystemHubSections,
} from "@/services/design-system-hub";
import { type Href, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";

function SourcePills({
  sources,
}: {
  sources: string[];
}) {
  return (
    <View style={styles.sourceRow}>
      {sources.map((source) => (
        <View key={source} style={styles.sourcePill}>
          <FinanceText variant="caption" tone="secondary" weight="bold">
            {source}
          </FinanceText>
        </View>
      ))}
    </View>
  );
}

export default function DesignSystemPatternsScreen() {
  const router = useRouter();
  const routeCount = designSystemHubSections.length;

  return (
    <View style={designSystemSharedStyles.pageStack}>
      <DesignSystemPageHero
        eyebrow="Pattern governance"
        title="Patronen en opbouwregels"
        subtitle="Hier leggen we vast hoe shells, kaarten en utility-flows in Budio consistent blijven. Gebruik dit als beslishulp, niet als vrijblijvende stijlpagina."
        actions={[
          {
            label: "Componenten",
            onPress: () => router.push("/admin/design-system/components" as Href),
          },
          {
            label: "Bronnen & sync",
            onPress: () => router.push("/admin/design-system/sources" as Href),
            variant: "secondary",
          },
        ]}
        statuses={[
          { label: "Utility regels", tone: "watch" },
          { label: "Admin-only", tone: "critical" },
          { label: "Code + docs", tone: "good" },
        ]}
      />

      <DesignSystemStatsRow
        items={[
          { label: "Patroonblokken", value: `${designSystemHubPatternBlocks.length}` },
          { label: "Shell-types", value: "4" },
          { label: "Hub-routes", value: `${routeCount}` },
          { label: "Doel", value: "Beslisconsistentie", tone: "muted" },
        ]}
      />

      <FinanceDetailCard
        title="Kernregels"
        subtitle="Gebruik, vermijd en afwijken"
      >
        <View style={styles.ruleStack}>
          <DesignSystemSubtlePanel>
            <FinanceText variant="body-sm" tone="secondary">
              Gebruik dit patroon voor een duidelijke taak, niet voor visuele opvulling.
            </FinanceText>
          </DesignSystemSubtlePanel>
          <DesignSystemSubtlePanel>
            <FinanceText variant="body-sm" tone="secondary">
              Gebruik dit niet voor een scherm dat als hoofdscherm hoort te voelen.
            </FinanceText>
          </DesignSystemSubtlePanel>
          <DesignSystemSubtlePanel>
            <FinanceText variant="body-sm" tone="secondary">
              Afwijken mag alleen als de shell, de taak of de context aantoonbaar anders is.
            </FinanceText>
          </DesignSystemSubtlePanel>
        </View>
      </FinanceDetailCard>

      <DesignSystemBlockGrid>
        <FinanceSettingsGroup title="Shell mapping">
          <FinanceSettingsRow
            label="Hoofdscherm"
            subtitle="Gebruik de gedeelde app-shell met hero en dominante hoofdstat."
            value="FinanceHeroShell"
          />
          <FinanceSettingsRow
            label="Utility / detail"
            subtitle="Gebruik compacte beheer-, detail- of sheet-shells."
            value="FinanceUtilityShell / FinanceDetailShell"
          />
          <FinanceSettingsRow
            label="Admin"
            subtitle="Admin-only beheerlaag en referentiehub."
            value="FinanceAdminShell"
          />
          <FinanceSettingsRow
            label="Modal / sheet"
            subtitle="Selectie- en confirmflows blijven in de gedeelde sheet-shell."
            value="FinanceBottomSheetShell"
          />
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Bouwregels">
          <View style={styles.ruleStack}>
            <FinanceDetailCard
              title="Hoofdscherm vs utility/subscherm"
              subtitle="Kies de shell op basis van de taak, niet op basis van de route-naam."
            >
              <FinanceText variant="body-sm" tone="secondary">
                Hoofdschermen sturen op stand, ruimte, risico en volgende actie. Utility-schermen verdiepen of beheren.
              </FinanceText>
            </FinanceDetailCard>
            <FinanceDetailCard
              title="Mobile-first"
              subtitle="De verticale flow is leidend."
              tone="subtle"
            >
              <FinanceText variant="body-sm" tone="secondary">
                Houd content in de gecentreerde kolom, vermijd vroegtijdige desktopkolommen en gebruik touch targets die rustig aanvoelen.
              </FinanceText>
            </FinanceDetailCard>
            <FinanceDetailCard
              title="Klikbaarheid en hiërarchie"
              subtitle="Maak actie zichtbaar, maar niet luid."
              tone="subtle"
            >
              <FinanceText variant="body-sm" tone="secondary">
                Gebruik vorm, contrast en iconografie om klikbaarheid duidelijk te maken. Geef secundaire info geen gelijk volume.
              </FinanceText>
            </FinanceDetailCard>
          </View>
        </FinanceSettingsGroup>
      </DesignSystemBlockGrid>

      <FinanceSettingsGroup title="Patroonblokken">
        <View style={styles.ruleStack}>
          {designSystemHubPatternBlocks.map((block) => (
            <FinanceDetailCard key={block.title} title={block.title} subtitle={block.useWhen}>
              <FinanceText variant="body-sm" tone="secondary">
                Niet gebruiken voor: {block.avoidWhen}
              </FinanceText>
              <SourcePills sources={block.sources} />
            </FinanceDetailCard>
          ))}
        </View>
      </FinanceSettingsGroup>

      <DesignSystemBlockGrid>
        <FinanceSettingsGroup title="Concreet toepassen">
          <FinanceDetailCard title="Modal / bottom-sheet patronen" tone="subtle">
            <View style={styles.ruleStack}>
              <FinanceText variant="body-sm" tone="secondary">
                Gebruik dit patroon voor create/edit, confirm, selectie en flows waarin de huidige context zichtbaar moet blijven.
              </FinanceText>
              <FinanceText variant="body-sm" tone="secondary">
                Gebruik dit niet voor volledige schermen of situaties waarin de gebruiker een nieuwe navigatiecontext nodig heeft.
              </FinanceText>
              <FinanceText variant="body-sm" tone="secondary">
                Wees streng op één backdrop, één handle, één close-knop en één vaste footerzone.
              </FinanceText>
            </View>
          </FinanceDetailCard>
          <FinanceDetailCard title="Admin utility-richtlijnen" tone="subtle">
            <View style={styles.ruleStack}>
              <FinanceText variant="body-sm" tone="secondary">
                Adminlagen zijn interne referenties, geen nieuwe productidentiteit.
              </FinanceText>
              <FinanceText variant="body-sm" tone="secondary">
                Gebruik rustige chipnavigatie of grouped rows; bouw geen nieuw shell-patroon bovenop de admin-shell.
              </FinanceText>
              <FinanceText variant="body-sm" tone="secondary">
                Houd notities en bronverwijzingen zichtbaar zodat developers en designers dezelfde richting volgen.
              </FinanceText>
            </View>
          </FinanceDetailCard>
        </FinanceSettingsGroup>

        <FinanceDetailCard
          title="Pattern-snelle check"
          subtitle="Voor je iets nieuws bouwt"
          tone="subtle"
        >
          <View style={styles.ruleStack}>
            <FinanceSettingsRow
              label="Is dit hoofdscherm?"
              subtitle="Alleen dan hero + cockpitritme."
              value="ja/nee"
            />
            <FinanceSettingsRow
              label="Is dit utility?"
              subtitle="Gebruik detail of sheet-shell."
              value="ja/nee"
            />
            <FinanceSettingsRow
              label="Bestaat patroon al?"
              subtitle="Eerst in componenten/tokens checken."
              value="verplicht"
            />
          </View>
        </FinanceDetailCard>
      </DesignSystemBlockGrid>

      <FinanceSettingsGroup title="Flow-specifieke patronen">
        <View style={styles.ruleStack}>
          {designSystemHubFlowCoverage.map((flow) => (
            <FinanceDetailCard
              key={`flow-pattern-${flow.area}`}
              title={flow.area}
              subtitle={flow.shell}
              tone="subtle"
            >
              <View style={styles.ruleStack}>
                {flow.patternFocus.map((item) => (
                  <FinanceText key={`${flow.area}-pattern-${item}`} variant="body-sm" tone="secondary">
                    • {item}
                  </FinanceText>
                ))}
                <FinanceText variant="caption" tone="muted">
                  Bronnen: {flow.sourceFocus.join(" · ")}
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
  ruleStack: {
    gap: FinSpacing.x2,
  },
  sourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
    paddingTop: FinSpacing.x1,
  },
  sourcePill: {
    borderRadius: 999,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
    backgroundColor: FinColors.bgInput,
  },
});
