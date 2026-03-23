import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type MenuItem = {
  label: string;
  iconName: AppIconName;
  path:
    | "/"
    | "/transactions"
    | "/insights"
    | "/insights-legacy"
    | "/budget"
    | "/subscriptions"
    | "/settings";
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard", iconName: "space-dashboard", path: "/" },
  { label: "Transactions", iconName: "receipt-long", path: "/transactions" },
  { label: "Insights", iconName: "insights", path: "/insights" },
  { label: "Insights (oud)", iconName: "history", path: "/insights-legacy" },
  { label: "Budget", iconName: "account-balance-wallet", path: "/budget" },
  { label: "Abonnementen", iconName: "subscriptions", path: "/subscriptions" },
  { label: "Settings", iconName: "settings", path: "/settings" },
];

function normalizePath(pathname: string): string {
  if (pathname === "") return "/";
  if (pathname === "/index") return "/";
  return pathname;
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
  const [open, setOpen] = React.useState(false);

  const currentPath = normalizePath(pathname || "/");

  const handleNavigate = React.useCallback(
    (path: MenuItem["path"]) => {
      setOpen(false);
      if (path === currentPath) return;
      router.push(path as never);
    },
    [currentPath, router],
  );

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
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Navigatie</Text>
            {MENU_ITEMS.map((item) => {
              const active = currentPath === item.path;
              return (
                <Pressable
                  key={item.path}
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => handleNavigate(item.path)}
                  accessibilityRole="button"
                >
                  <View style={styles.itemIconWrap}>
                    <AppIcon
                      name={item.iconName}
                      size={18}
                      color={
                        active ? FinColors.warningText : FinColors.textSecondary
                      }
                      variant="outlined"
                    />
                  </View>
                  <Text
                    style={[styles.itemText, active && styles.itemTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
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
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.16)",
  },
  panel: {
    width: 248,
    marginTop: 64,
    marginLeft: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 14,
  },
  panelTitle: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  itemTextActive: {
    color: FinColors.warningText,
  },
  itemIconWrap: {
    width: 24,
    alignItems: "center",
    marginRight: 10,
  },
});
