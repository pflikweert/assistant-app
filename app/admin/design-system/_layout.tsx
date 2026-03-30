import { FinanceAdminShell } from "@/components/ui/finance-admin-shell";
import { useAdminAccess } from "@/services/admin-access";
import { type Href, Slot, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { FinColors, FinRadius, FinSpacing, FinSurfaces } from "@/constants/theme";
import { DesignSystemNav } from "@/components/admin/design-system-hub";

export default function DesignSystemLayout() {
  const access = useAdminAccess();
  const router = useRouter();

  React.useEffect(() => {
    if (access.loading) return;
    if (!access.isAdmin) {
      router.replace("/settings" as Href);
    }
  }, [access.isAdmin, access.loading, router]);

  if (access.loading || !access.isAdmin) {
    return (
      <FinanceAdminShell
        title="Design System"
        subtitle="Interne design-governance laag voor Budio."
        onBack={() => router.push("/admin" as Href)}
      >
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={FinColors.green} />
          <Text style={styles.loadingText}>
            {access.loading ? "Design system wordt geladen…" : "Je wordt teruggeleid naar instellingen…"}
          </Text>
        </View>
      </FinanceAdminShell>
    );
  }

  return (
    <FinanceAdminShell
      title="Design System"
      subtitle="Interne design-governance laag voor tokens, componenten, patronen en sync."
      onBack={() => router.push("/admin" as Href)}
    >
      <DesignSystemNav />
      <Slot />
    </FinanceAdminShell>
  );
}

const styles = {
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: FinSpacing.m,
    paddingVertical: FinSpacing["3xl"],
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgCard,
    ...FinSurfaces.topLevelCard,
  },
  loadingText: {
    color: FinColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
};
