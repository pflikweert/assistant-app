import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type BudgetPressureSeverity = "watch" | "critical";

export type BudgetPressureItem = {
  id: string;
  title: string;
  description: string;
  severity: BudgetPressureSeverity;
  icon: AppIconName;
  onPress?: () => void;
};

type BudgetPressureListProps = {
  title?: string;
  items: BudgetPressureItem[];
};

function resolveSignalIcon(
  item: BudgetPressureItem,
): { name: AppIconName; color: string } {
  if (item.onPress) {
    return { name: "chevron-right", color: FinColors.textSecondary };
  }

  if (item.severity === "critical") {
    return { name: "trending-up", color: FinColors.red };
  }

  return { name: "trending-up", color: FinColors.warningText };
}

function resolveIconBubbleStyle(severity: BudgetPressureSeverity) {
  if (severity === "critical") return styles.iconBubbleCritical;
  return styles.iconBubbleWatch;
}

export function BudgetPressureList({
  title = "Waar zit druk",
  items,
}: BudgetPressureListProps) {
  const visibleItems = items.slice(0, 4);
  if (!visibleItems.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View style={styles.stack}>
        {visibleItems.map((item) => {
          const signalIcon = resolveSignalIcon(item);
          const content = (
            <>
              <View style={styles.rowMain}>
                <View style={[styles.iconBubble, resolveIconBubbleStyle(item.severity)]}>
                  <AppIcon
                    name={item.icon}
                    size={16}
                    color={item.severity === "critical" ? FinColors.red : FinColors.warningText}
                    variant="outlined"
                  />
                </View>

                <View style={styles.copyWrap}>
                  <Text numberOfLines={1} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={2} style={styles.itemDescription}>
                    {item.description}
                  </Text>
                </View>
              </View>

              <AppIcon
                name={signalIcon.name}
                size={17}
                color={signalIcon.color}
                variant="outlined"
              />
            </>
          );

          if (item.onPress) {
            return (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.itemCard,
                  pressed ? styles.itemCardPressed : null,
                ]}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View key={item.id} style={styles.itemCard}>
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: FinColors.textMuted,
  },
  stack: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 24,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  itemCardPressed: {
    opacity: 0.86,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleWatch: {
    backgroundColor: FinColors.warningBg,
  },
  iconBubbleCritical: {
    backgroundColor: FinColors.redBg,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.2,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 17,
    color: FinColors.textSecondary,
  },
});
