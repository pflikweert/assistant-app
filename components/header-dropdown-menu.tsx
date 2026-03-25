import { useSession } from "@/app/_layout";
import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { usePathname, useRouter, type Href } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type MenuItem = {
  label: string;
  iconName: AppIconName;
  path: "/" | "/transactions" | "/insights" | "/budget";
};

type SecondaryMenuItem = {
  label: string;
  iconName: AppIconName;
  path: "/settings" | "/account/change-password";
};

const MAIN_ITEMS: MenuItem[] = [
  { label: "Dashboard", iconName: "space-dashboard", path: "/" },
  { label: "Budget", iconName: "account-balance-wallet", path: "/budget" },
  { label: "Transacties", iconName: "receipt-long", path: "/transactions" },
  { label: "Inzichten", iconName: "insights", path: "/insights" },
];

const SETTINGS_ITEMS: SecondaryMenuItem[] = [
  { label: "Profiel Instellingen", iconName: "manage-accounts", path: "/settings" },
  { label: "Beveiliging", iconName: "shield", path: "/account/change-password" },
];

const SUPPORT_ITEMS: SecondaryMenuItem[] = [
  { label: "Klantenservice", iconName: "support-agent", path: "/settings" },
  { label: "Algemene Voorwaarden", iconName: "description", path: "/settings" },
];

function normalizePath(pathname: string): string {
  if (pathname === "") return "/";
  if (pathname === "/index") return "/";
  return pathname;
}

function resolveDisplayName(user: ReturnType<typeof useSession>["user"]) {
  const metadata = user?.user_metadata as
    | { name?: string; full_name?: string }
    | null
    | undefined;
  const rawName = metadata?.full_name || metadata?.name || null;

  if (rawName && rawName.trim()) return rawName.trim();
  if (user?.email) {
    const localPart = user.email.split("@")[0] || "";
    const normalized = localPart
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized) return normalized;
  }
  return "Je profiel";
}

type HeaderDropdownMenuBaseProps = {
  mode?: "default" | "detail";
};

export default function HeaderDropdownMenu({
  mode = "default",
}: HeaderDropdownMenuBaseProps) {
  return <HeaderDropdownMenuBase mode={mode} />;
}

export function HeaderDropdownMenuBase({
  mode = "default",
}: HeaderDropdownMenuBaseProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const currentPath = normalizePath(pathname || "/");
  const displayName = React.useMemo(() => resolveDisplayName(user), [user]);

  const handleNavigate = React.useCallback(
    (path: MenuItem["path"] | SecondaryMenuItem["path"]) => {
      setOpen(false);
      if (path === currentPath) return;
      router.push(path as Href);
    },
    [currentPath, router],
  );

  const handleLogout = React.useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    setOpen(false);
    try {
      await logout();
      router.replace("/auth/login" as Href);
    } catch (error) {
      console.warn("[menu] logout failed", error);
    } finally {
      setSigningOut(false);
    }
  }, [logout, router, signingOut]);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
      >
        <AppIcon
          name="menu"
          size={18}
          color={FinColors.textPrimary}
          variant="outlined"
        />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <FinanceScreenBackdrop tone="neutral" />
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} />

          <View style={styles.contentShell}>
            <View style={styles.topBar}>
              <View style={styles.topSpacer} />
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Sluit menu"
              >
                <AppIcon
                  name="close"
                  size={22}
                  color={FinColors.textSecondary}
                  variant="outlined"
                />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.hero}>
                <View style={styles.avatarWrap}>
                  <FinanceAvatarBadge size={58} />
                  <View style={styles.onlineDot} />
                </View>

                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>WELKOM TERUG</Text>
                  <Text style={styles.name} numberOfLines={2}>
                    {displayName}
                  </Text>
                  <Text style={styles.subtitle}>Beheer je geld</Text>
                </View>
              </View>

              <View style={styles.primaryList}>
                {MAIN_ITEMS.map((item) => {
                  const active = currentPath === item.path;
                  return (
                    <Pressable
                      key={item.path}
                      style={({ pressed }) => [
                        styles.primaryItem,
                        active && styles.primaryItemActive,
                        pressed && styles.itemPressed,
                      ]}
                      onPress={() => handleNavigate(item.path)}
                      accessibilityRole="button"
                      accessibilityState={active ? { selected: true } : {}}
                    >
                      <View style={styles.primaryItemLeft}>
                        <View style={styles.primaryIconWrap}>
                          <AppIcon
                            name={item.iconName}
                            size={18}
                            color={active ? FinColors.textPrimary : FinColors.textSecondary}
                            variant="outlined"
                          />
                        </View>
                        <Text style={[styles.primaryLabel, active && styles.primaryLabelActive]}>
                          {item.label}
                        </Text>
                      </View>
                      <AppIcon
                        name="arrow-forward"
                        size={18}
                        color={active ? FinColors.textPrimary : FinColors.textSecondary}
                        variant="outlined"
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>INSTELLINGEN</Text>
                <View style={styles.secondaryList}>
                  {SETTINGS_ITEMS.map((item) => (
                    <Pressable
                      key={item.path}
                      style={({ pressed }) => [styles.secondaryItem, pressed && styles.itemPressed]}
                      onPress={() => handleNavigate(item.path)}
                      accessibilityRole="button"
                    >
                      <View style={styles.secondaryLeft}>
                        <AppIcon
                          name={item.iconName}
                          size={18}
                          color={FinColors.textSecondary}
                          variant="outlined"
                        />
                        <Text style={styles.secondaryLabel}>{item.label}</Text>
                      </View>
                      <AppIcon
                        name="chevron-right"
                        size={18}
                        color={FinColors.textSecondary}
                        variant="outlined"
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SUPPORT</Text>
                <View style={styles.secondaryList}>
                  {SUPPORT_ITEMS.map((item) => (
                    <Pressable
                      key={item.label}
                      style={({ pressed }) => [styles.secondaryItem, pressed && styles.itemPressed]}
                      onPress={() => handleNavigate(item.path)}
                      accessibilityRole="button"
                    >
                      <View style={styles.secondaryLeft}>
                        <AppIcon
                          name={item.iconName}
                          size={18}
                          color={FinColors.textSecondary}
                          variant="outlined"
                        />
                        <Text style={styles.secondaryLabel}>{item.label}</Text>
                      </View>
                      <AppIcon
                        name="chevron-right"
                        size={18}
                        color={FinColors.textSecondary}
                        variant="outlined"
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>Budio</Text>
                <View style={styles.brandDot} />
                <Text style={styles.version}>Versie 0.1</Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && styles.logoutButtonPressed,
                  signingOut && styles.logoutButtonDisabled,
                ]}
                onPress={() => void handleLogout()}
                accessibilityRole="button"
                disabled={signingOut}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color={FinColors.warningText} />
                ) : (
                  <>
                    <AppIcon
                      name="logout"
                      size={18}
                      color={FinColors.warningText}
                      variant="outlined"
                    />
                    <Text style={styles.logoutLabel}>Uitloggen</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,247,235,0.84)",
  },
  contentShell: {
    flex: 1,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 14,
  },
  topSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    boxShadow: "0px 10px 18px rgba(17,17,17,0.05)",
  },
  closeButtonPressed: {
    opacity: 0.88,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  avatarWrap: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2fbe62",
    borderWidth: 2,
    borderColor: FinColors.bgCard,
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#7d6f2d",
    marginBottom: 4,
  },
  name: {
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  primaryList: {
    gap: 12,
    marginBottom: 22,
  },
  primaryItem: {
    minHeight: 62,
    borderRadius: 22,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryItemActive: {
    backgroundColor: FinColors.yellow,
    borderColor: "rgba(167,132,0,0.45)",
  },
  itemPressed: {
    opacity: 0.9,
  },
  primaryItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  primaryIconWrap: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  primaryLabelActive: {
    color: FinColors.textPrimary,
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: FinColors.textMuted,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  secondaryList: {
    gap: 10,
  },
  secondaryItem: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  secondaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  secondaryLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "600",
  },
  footer: {
    gap: 14,
    paddingTop: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brand: {
    fontSize: 20,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
  },
  version: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  logoutButton: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    boxShadow: "0px 10px 20px rgba(17,17,17,0.05)",
  },
  logoutButtonPressed: {
    opacity: 0.92,
  },
  logoutButtonDisabled: {
    opacity: 0.75,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: FinColors.warningText,
  },
});
