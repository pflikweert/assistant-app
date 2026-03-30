import {
  DesignSystemBlockGrid,
  DesignSystemPageHero,
  DesignSystemStatsRow,
} from "@/components/admin/design-system-page-kit";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
import {
  designSystemHubBorderTokens,
  designSystemHubColorTokens,
  designSystemHubFontFamilies,
  designSystemHubFlowCoverage,
  designSystemHubRadiusTokens,
  designSystemHubShadowTokens,
  designSystemHubSpacingTokens,
  designSystemHubTypographyTokens,
} from "@/services/design-system-hub";
import React from "react";
import { StyleSheet, View } from "react-native";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";

function TokenMeta({
  keyName,
  value,
  usage,
}: {
  keyName: string;
  value: string;
  usage: string;
}) {
  return (
    <View style={styles.tokenMeta}>
      <FinanceText variant="body-sm" weight="bold" tone="primary">
        {keyName}
      </FinanceText>
      <FinanceText variant="caption" tone="secondary">
        {value}
      </FinanceText>
      <FinanceText variant="caption" tone="muted">
        {usage}
      </FinanceText>
    </View>
  );
}

function ColorTokenRow({
  keyName,
  value,
  usage,
}: {
  keyName: string;
  value: string;
  usage: string;
}) {
  return (
    <View style={styles.colorRow}>
      <View style={[styles.colorSwatch, { backgroundColor: value }]} />
      <TokenMeta keyName={keyName} value={value} usage={usage} />
    </View>
  );
}

function FontFamilyCard({
  name,
  purpose,
  example,
  source,
  codeLabel,
}: {
  name: string;
  purpose: string;
  example: string;
  source: string;
  codeLabel: string;
}) {
  return (
    <FinanceDetailCard
      title={name}
      subtitle={purpose}
      rightSlot={<FinanceText variant="caption" tone="muted">{source}</FinanceText>}
    >
      <FinanceText variant="body-sm" tone="secondary">
        {example}
      </FinanceText>
      <FinanceText variant="caption" tone="muted">
        {codeLabel}
      </FinanceText>
    </FinanceDetailCard>
  );
}

export default function DesignSystemTokensScreen() {
  return (
    <View style={designSystemSharedStyles.pageStack}>
      <DesignSystemPageHero
        eyebrow="Design tokens"
        title="Tokencatalogus uit de codebase"
        subtitle="Alleen bestaande of herleidbare tokens. Geen nieuwe tokenlaag, geen stille aannames."
        statuses={[
          { label: "Live uit theme", tone: "good" },
          { label: "Admin-only", tone: "critical" },
        ]}
      />

      <DesignSystemStatsRow
        items={[
          { label: "Kleurtokens", value: `${designSystemHubColorTokens.length}` },
          { label: "Type tokens", value: `${designSystemHubTypographyTokens.length}` },
          { label: "Spacing tokens", value: `${designSystemHubSpacingTokens.length}` },
          { label: "Radius tokens", value: `${designSystemHubRadiusTokens.length}` },
        ]}
      />

      <DesignSystemBlockGrid>
        <FinanceDetailCard
          title="Tokencontract"
          subtitle="Leidende bron en uitleg"
          rightSlot={<FinanceText variant="caption" tone="muted">runtime</FinanceText>}
        >
          <FinanceText variant="body-sm" tone="secondary">
            Primaire bron: <FinanceText variant="body-sm" weight="bold">constants/theme.ts</FinanceText>
          </FinanceText>
          <FinanceText variant="caption" tone="muted">
            Design docs sturen de richting, maar de waarden hier komen uit de runtime bron of zijn daar direct uit herleid.
          </FinanceText>
        </FinanceDetailCard>

        <FinanceSettingsGroup title="Kleuren">
          <View style={styles.grid}>
            {designSystemHubColorTokens.map((token) => (
              <ColorTokenRow
                key={token.key}
                keyName={token.key}
                value={token.value}
                usage={token.usage}
              />
            ))}
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Font families">
          <View style={styles.stack}>
            {designSystemHubFontFamilies.map((font) => (
              <FontFamilyCard
                key={font.name}
                name={font.name}
                purpose={font.purpose}
                example={font.example}
                source={font.source}
                codeLabel={font.status === "docs-backed" ? "Designrichting uit docs" : "Huidige code fallback"}
              />
            ))}
          </View>
        </FinanceSettingsGroup>
      </DesignSystemBlockGrid>

      <FinanceSettingsGroup title="Typografie">
        <View style={styles.stack}>
          {designSystemHubTypographyTokens.map((token) => (
            <FinanceDetailCard
              key={token.key}
              title={token.key}
              subtitle={token.usage}
              rightSlot={<FinanceText variant="caption" tone="muted">{token.value}</FinanceText>}
            >
              <FinanceText variant={token.key} weight="bold" tone="primary">
                {token.sample}
              </FinanceText>
            </FinanceDetailCard>
          ))}
        </View>
      </FinanceSettingsGroup>

      <DesignSystemBlockGrid>
        <FinanceSettingsGroup title="Spacing">
          <View style={styles.stack}>
            {designSystemHubSpacingTokens.map((token) => {
              const barWidth = token.value === 0 ? 8 : Math.min(token.value * 2, 64);
              return (
                <View key={token.key} style={styles.scaleRow}>
                  <View style={styles.scalePreviewShell}>
                    <View style={[styles.scalePreview, { width: barWidth }]} />
                  </View>
                  <TokenMeta keyName={token.key} value={`${token.value}px`} usage={token.usage} />
                </View>
              );
            })}
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Radius">
          <View style={styles.stack}>
            {designSystemHubRadiusTokens.map((token) => (
              <View key={token.key} style={styles.radiusRow}>
                <View style={[styles.radiusPreview, { borderRadius: token.value }]} />
                <TokenMeta keyName={token.key} value={`${token.value}px`} usage={token.usage} />
              </View>
            ))}
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Borders & overlays">
          <View style={styles.stack}>
            {designSystemHubBorderTokens.map((token) => (
              <View key={token.key} style={styles.borderRow}>
                <View
                  style={[
                    styles.borderPreview,
                    token.key === "borderWidth"
                      ? styles.borderPreviewWidth
                      : { borderColor: token.value as string },
                  ]}
                >
                  <FinanceText variant="caption" tone="muted">
                    {token.key}
                  </FinanceText>
                </View>
                <TokenMeta
                  keyName={token.key}
                  value={String(token.value)}
                  usage={token.note ? `${token.usage} · ${token.note}` : token.usage}
                />
              </View>
            ))}
          </View>
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Shadows">
          <View style={styles.stack}>
            {designSystemHubShadowTokens.map((token) => (
              <View key={token.key} style={styles.shadowRow}>
                <View style={[styles.shadowPreview, { boxShadow: token.value, elevation: 1 } as any]}>
                  <FinanceText variant="caption" tone="muted">
                    shadow
                  </FinanceText>
                </View>
                <TokenMeta keyName={token.key} value={token.value} usage={token.usage} />
              </View>
            ))}
          </View>
        </FinanceSettingsGroup>
      </DesignSystemBlockGrid>

      <FinanceDetailCard
        title="Technische aandachtspunten"
        subtitle="Markeer dit zichtbaar, verstop het niet."
      >
        <View style={styles.stack}>
          <FinanceText variant="body-sm" tone="secondary">
            • Border widths zijn nog niet volledig getokenized; gebruik bestaande componentranden.
          </FinanceText>
          <FinanceText variant="body-sm" tone="secondary">
            • Manrope en Inter zijn designrichting in de repo-docs; de runtime fontloads zijn nog niet overal hard afgedwongen.
          </FinanceText>
          <FinanceText variant="body-sm" tone="secondary">
            • De fallback stacks in code moeten niet worden aangezien voor een nieuwe fontstrategie.
          </FinanceText>
        </View>
      </FinanceDetailCard>

      <FinanceSettingsGroup title="Tokenfocus op kritieke flows">
        <View style={styles.stack}>
          {designSystemHubFlowCoverage.map((flow) => (
            <FinanceDetailCard
              key={flow.area}
              title={flow.area}
              subtitle={flow.routes.join(" · ")}
              tone="subtle"
            >
              <View style={styles.stack}>
                {flow.tokenFocus.map((item) => (
                  <FinanceText key={`${flow.area}-${item}`} variant="body-sm" tone="secondary">
                    • {item}
                  </FinanceText>
                ))}
                <FinanceText variant="caption" tone="muted">
                  Datamodus: {flow.dataMode === "live" ? "live" : "mixed"} · {flow.attention}
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
  grid: {
    gap: FinSpacing.x2,
  },
  stack: {
    gap: FinSpacing.x2,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  tokenMeta: {
    flex: 1,
    gap: 2,
  },
  scaleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
  },
  scalePreviewShell: {
    width: 80,
    height: 28,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgInput,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  scalePreview: {
    height: 10,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.warningText,
  },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
  },
  radiusPreview: {
    width: 54,
    height: 38,
    backgroundColor: FinColors.bgCardSoftCool,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  borderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
  },
  borderPreview: {
    width: 110,
    height: 46,
    borderWidth: 1,
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  borderPreviewWidth: {
    borderColor: FinColors.border,
    borderWidth: 3,
  },
  shadowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
  },
  shadowPreview: {
    width: 110,
    height: 46,
    borderRadius: FinRadius.lg,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
});
