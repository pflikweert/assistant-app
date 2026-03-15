import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { getRootCategoryKey } from "@/services/category-display";
import type { CategoryRecord } from "@/types/categorization";
import React from "react";
import { StyleSheet, View } from "react-native";

type CategorizedRow = {
  category_id_auto?: string | null;
  category_id_user?: string | null;
};
function getIconNameForRootKey(rootKey: string | null): AppIconName {
  const key = String(rootKey || "").toLowerCase();

  if (!key || key.includes("other")) return "help-outline";
  if (key.includes("income")) return "trending-up";
  if (key.includes("housing") || key.includes("home")) return "home";
  if (key.includes("care") || key.includes("health")) return "medical-services";
  if (key.includes("auto") || key.includes("car") || key.includes("fuel")) {
    return "directions-car";
  }
  if (key.includes("transport") || key.includes("travel")) {
    return "directions-transit";
  }
  if (
    key.includes("grocery") ||
    key.includes("food") ||
    key.includes("supermarket")
  ) {
    return "shopping-basket";
  }
  if (key.includes("subscription") || key.includes("recurring")) {
    return "subscriptions";
  }
  if (key.includes("leisure") || key.includes("entertainment")) {
    return "celebration";
  }
  if (key.includes("shopping") || key.includes("retail")) return "shopping-bag";
  if (key.includes("contribution") || key.includes("donation")) {
    return "volunteer-activism";
  }
  if (key.includes("saving") || key.includes("investment")) return "savings";
  if (key.includes("debt") || key.includes("loan")) return "credit-card";
  if (key.includes("tax")) return "receipt-long";
  if (key.includes("insurance")) return "verified-user";
  if (key.includes("education")) return "school";
  if (key.includes("business")) return "business-center";
  if (key.includes("utility") || key.includes("energy")) return "bolt";

  return "payments";
}

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
  const rootKey = getRootCategoryKey(row, categoryById);
  const iconName = getIconNameForRootKey(rootKey);

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
