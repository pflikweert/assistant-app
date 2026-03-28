import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinColors, FinSpacing } from "@/constants/theme";
import React from "react";
import {
  type ScrollViewProps,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from "react-native";

type FinanceDetailShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  tone?: "warm" | "neutral";
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentMaxStyle?: StyleProp<ViewStyle>;
  scrollProps?: Pick<
    ScrollViewProps,
    "keyboardShouldPersistTaps" | "showsVerticalScrollIndicator"
  >;
  children: React.ReactNode;
};

export function FinanceDetailShell({
  title,
  subtitle,
  onBack,
  rightSlot,
  tone = "warm",
  contentContainerStyle,
  contentMaxStyle,
  scrollProps,
  children,
}: FinanceDetailShellProps) {
  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone={tone} />
      <FinanceDetailTopBar
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        rightSlot={rightSlot}
        shellStyle={styles.topBar}
      />
      <ScrollView
        showsVerticalScrollIndicator={
          scrollProps?.showsVerticalScrollIndicator ?? false
        }
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps}
        contentContainerStyle={[styles.scroll, contentContainerStyle]}
      >
        <View style={[styles.contentMax, contentMaxStyle]}>{children}</View>
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
    gap: FinSpacing.x3,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: FinSpacing.x4,
    gap: FinSpacing.x3,
  },
});
