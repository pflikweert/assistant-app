import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinColors, FinSpacing } from "@/constants/theme";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

type FinanceAdminShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function FinanceAdminShell({
  title,
  subtitle,
  onBack,
  rightSlot,
  contentContainerStyle,
  children,
}: FinanceAdminShellProps) {
  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="neutral" />
      <FinanceDetailTopBar
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        rightSlot={rightSlot}
        shellStyle={styles.topBar}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, contentContainerStyle]}
      >
        <View style={styles.contentMax}>{children}</View>
      </ScrollView>
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
    paddingTop: FinSpacing.x20,
    paddingBottom: FinSpacing.x32,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: FinSpacing.xs,
    gap: FinSpacing.s,
  },
});
