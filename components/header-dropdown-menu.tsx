import { FinColors } from "@/constants/theme";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type MenuItem = {
  label: string;
  path:
    | "/"
    | "/transactions"
    | "/insights"
    | "/budget"
    | "/subscriptions"
    | "/settings";
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard", path: "/" },
  { label: "Transactions", path: "/transactions" },
  { label: "Insights", path: "/insights" },
  { label: "Budget", path: "/budget" },
  { label: "Abonnementen", path: "/subscriptions" },
  { label: "Settings", path: "/settings" },
];

function normalizePath(pathname: string): string {
  if (pathname === "") return "/";
  if (pathname === "/index") return "/";
  return pathname;
}

export default function HeaderDropdownMenu() {
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
        <Text style={styles.triggerText}>Menu</Text>
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
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
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 88,
    paddingRight: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    padding: 12,
    gap: 6,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  itemText: {
    fontSize: 14,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  itemTextActive: {
    color: FinColors.green,
  },
});
