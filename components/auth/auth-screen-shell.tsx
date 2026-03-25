import { FinColors, Fonts } from "@/constants/theme";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import type { Href } from "expo-router";
import { Link } from "expo-router";
import { Image } from "expo-image";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AuthLink = {
  href: Href;
  label: string;
  prompt?: string;
};

export function AuthScreenShell({
  title,
  subtitle,
  children,
  links = [],
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  links?: AuthLink[];
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={[styles.backgroundGlowTop, styles.noPointerEvents]} />
      <View style={[styles.backgroundGlowBottom, styles.noPointerEvents]} />
      <View style={styles.topBar}>
        <Image
          source={require("../../assets/images/budio-logo.png")}
          style={styles.brandLogo}
          contentFit="contain"
          accessibilityLabel="Budio"
        />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        <FinanceHeroShell
          eyebrow="Veilige toegang"
          title={title}
          subtitle={subtitle}
          shellStyle={styles.heroShell}
          innerStyle={styles.heroInner}
          titleStyle={styles.heroTitle}
          subtitleStyle={styles.heroSubtitle}
          subtitleLineStyle={styles.heroSubtitleLine}
        />
        <View style={styles.heroGap} />
        <View style={styles.contentInner}>
          <View style={styles.body}>{children}</View>
          {links.length ? (
            <View style={styles.links}>
              {links.map((link) => (
                <Text key={`${link.href}`} style={styles.linkRow}>
                  {link.prompt ? `${link.prompt} ` : ""}
                  <Link href={link.href} style={styles.link}>
                    {link.label}
                  </Link>
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const authScreenStyles = StyleSheet.create({
  fieldGroup: {
    gap: 10,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldLabel: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  textLink: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.03)",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 18,
    fontSize: 16,
    color: FinColors.textPrimary,
    backgroundColor: FinColors.bgInput,
    minHeight: 58,
  },
  button: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    minHeight: 58,
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 20,
    boxShadow: "0px 10px 18px rgba(185,149,0,0.18)",
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: FinColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  helperText: {
    color: FinColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: {
    color: FinColors.red,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: FinColors.redBg,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  successText: {
    color: FinColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: FinColors.yellowSoft,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inlineHint: {
    color: "#B45B5B",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 6,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(242,201,76,0.22)",
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -120,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.05)",
  },
  noPointerEvents: {
    pointerEvents: "none",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    height: 76,
    paddingHorizontal: 24,
    backgroundColor: "rgba(246,245,242,0.78)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.06)",
    justifyContent: "center",
    boxShadow: "0px 8px 16px rgba(17,17,17,0.08)",
  },
  brandLogo: {
    width: 126,
    height: 56,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    overflow: "hidden",
  },
  contentInner: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    overflow: "hidden",
    gap: 28,
  },
  heroShell: {
    backgroundColor: FinColors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.05)",
    marginHorizontal: -24,
    alignSelf: "stretch",
  },
  heroInner: {
    maxWidth: 1040,
    paddingHorizontal: 24,
    paddingTop: 102,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -1.8,
    fontFamily: Fonts?.sans,
  },
  heroSubtitle: {
    fontSize: 18,
    lineHeight: 26,
  },
  heroSubtitleLine: {
    borderLeftColor: "rgba(138,115,0,0.28)",
  },
  heroGap: {
    height: 32,
  },
  body: {
    gap: 14,
  },
  links: {
    paddingTop: 12,
    gap: 10,
  },
  linkRow: {
    color: FinColors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  link: {
    color: "#705B00",
    fontWeight: "700",
  },
});
