import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { resolveTransactionCategoryIconName } from "@/services/category-icon";
import type { CategoryRecord } from "@/types/categorization";
import React from "react";
import { StyleSheet, View } from "react-native";

type CategorizedRow = {
  category_id_auto?: string | null;
  category_id_user?: string | null;
};

export function TransactionCategoryIcon({
  row,
  categoryById,
  size = 20,
  bubbleSize = 42,
}: {
  row: CategorizedRow;
  categoryById: Map<string, CategoryRecord>;
  size?: number;
  bubbleSize?: number;
}) {
  const iconName = resolveTransactionCategoryIconName(
    row,
    categoryById,
  ) as AppIconName;

  return (
    <View
      style={[
        styles.iconBubble,
        {
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: Math.round(bubbleSize / 3),
        },
      ]}
    >
      <AppIcon
        name={iconName}
        size={size}
        color={FinColors.textSecondary}
        variant="outlined"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBubble: {
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
});
