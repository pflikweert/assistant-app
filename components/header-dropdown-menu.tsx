import { FinColors } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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
        <MaterialIcons name="menu" size={18} color={FinColors.textPrimary} />
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
    gap: 4,
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
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  itemText: {
    fontSize: 14,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  itemTextActive: {
    color: FinColors.warningText,
  },
});
