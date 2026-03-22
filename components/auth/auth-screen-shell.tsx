import { FinColors, Fonts } from "@/constants/theme";
import type { Href } from "expo-router";
import { Link } from "expo-router";
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
        <View style={styles.brandWrap}>
          <View style={styles.brandMark}>
            <View style={styles.brandMarkLineShort} />
            <View style={styles.brandMarkLineLong} />
          </View>
          <Text style={styles.brandText}>Mijn Financien</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.contentInner}>
          <View style={styles.hero}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>Veilige toegang</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.subtitleWrap}>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>
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
    justifyContent: "flex-end",
    paddingBottom: 18,
    boxShadow: "0px 8px 16px rgba(17,17,17,0.08)",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242,201,76,0.16)",
    gap: 3,
  },
  brandMarkLineShort: {
    width: 12,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#876700",
  },
  brandMarkLineLong: {
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#876700",
  },
  brandText: {
    color: FinColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
    fontFamily: Fonts?.sans,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 104,
    paddingBottom: 32,
    overflow: "hidden",
  },
  contentInner: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    overflow: "hidden",
    gap: 28,
  },
  hero: {
    gap: 18,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#8A7300",
  },
  eyebrow: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2.2,
  },
  title: {
    color: FinColors.textPrimary,
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "800",
    letterSpacing: -1.6,
    fontFamily: Fonts?.sans,
  },
  subtitleWrap: {
    borderLeftWidth: 2,
    borderLeftColor: "rgba(138,115,0,0.28)",
    paddingLeft: 16,
    maxWidth: 360,
  },
  subtitle: {
    color: FinColors.textSecondary,
    fontSize: 16,
    lineHeight: 27,
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
