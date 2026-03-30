import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import { FinColors, FinSpacing } from "@/constants/theme";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

type FinanceUtilityShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onBack?: () => void;
  hero?: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle: React.ReactNode;
    shellStyle?: StyleProp<ViewStyle>;
  };
  contentContainerStyle?: StyleProp<ViewStyle>;
  disableScroll?: boolean;
  children: React.ReactNode;
};

export function FinanceUtilityShell({
  title,
  subtitle,
  rightSlot,
  onBack,
  hero,
  contentContainerStyle,
  disableScroll = false,
  children,
}: FinanceUtilityShellProps) {
  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      {onBack ? (
        <FinanceDetailTopBar
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          rightSlot={rightSlot}
          shellStyle={styles.topBar}
        />
      ) : (
        <FinanceTopBar
          title={title}
          subtitle={subtitle}
          rightSlot={rightSlot}
          shellStyle={styles.topBar}
        />
      )}
      {disableScroll ? (
        <View style={[styles.staticContent, contentContainerStyle]}>
          {hero ? (
          <FinanceHeroShell
            eyebrow={hero.eyebrow}
            title={hero.title}
            subtitle={hero.subtitle}
            layout="utility"
            shellStyle={hero.shellStyle}
          />
          ) : null}
          <View style={styles.contentMax}>{children}</View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, contentContainerStyle]}
        >
          {hero ? (
          <FinanceHeroShell
            eyebrow={hero.eyebrow}
            title={hero.title}
            subtitle={hero.subtitle}
            layout="utility"
            shellStyle={hero.shellStyle}
          />
          ) : null}
          <View style={styles.contentMax}>{children}</View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  scroll: {
    paddingTop: FinSpacing.x14,
    paddingBottom: FinSpacing.x32,
    gap: FinSpacing.x3,
  },
  staticContent: {
    flex: 1,
    paddingTop: FinSpacing.x14,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: FinSpacing.x4,
    gap: FinSpacing.x3,
  },
});
