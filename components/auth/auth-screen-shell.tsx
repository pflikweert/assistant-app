import { FinColors } from "@/constants/theme";
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Assistant</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: FinColors.textPrimary,
    backgroundColor: FinColors.bgElevated,
  },
  button: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    minHeight: 52,
    backgroundColor: FinColors.green,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: FinColors.bgBase,
    fontSize: 16,
    fontWeight: "700",
  },
  helperText: {
    color: FinColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: FinColors.red,
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    color: FinColors.green,
    fontSize: 14,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    borderRadius: 28,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  eyebrow: {
    color: FinColors.green,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    color: FinColors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: FinColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    marginTop: 8,
    gap: 12,
  },
  links: {
    marginTop: 8,
    gap: 8,
  },
  linkRow: {
    color: FinColors.textSecondary,
    fontSize: 14,
  },
  link: {
    color: FinColors.green,
    fontWeight: "700",
  },
});
