import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

type FinanceFlatChoiceCardProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
};

export function FinanceFlatChoiceCard({
  title,
  description,
  rightSlot,
  children,
  style,
  bodyStyle,
  titleStyle,
  descriptionStyle,
}: FinanceFlatChoiceCardProps) {
  return (
    <View style={[styles.flatCard, style]}>
      <View style={[styles.flatCardBody, bodyStyle]}>
        <View style={styles.flatCardText}>
          <Text style={[styles.flatCardTitle, titleStyle]}>{title}</Text>
          {description ? (
            <Text style={[styles.flatCardDescription, descriptionStyle]}>
              {description}
            </Text>
          ) : null}
        </View>
        {rightSlot ? <View style={styles.flatCardRight}>{rightSlot}</View> : null}
      </View>
      {children ? <View style={styles.flatCardChildren}>{children}</View> : null}
    </View>
  );
}

type FinanceSelectionIndicatorProps = {
  selected: boolean;
  size?: number;
};

export function FinanceSelectionIndicator({
  selected,
  size = 28,
}: FinanceSelectionIndicatorProps) {
  return (
    <View
      style={[
        styles.selectionIndicator,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        selected ? styles.selectionIndicatorSelected : null,
      ]}
    >
      <AppIcon
        name={selected ? "check-box" : "check-box-outline-blank"}
        size={selected ? size - 4 : size - 5}
        color={selected ? FinColors.yellow : FinColors.textSecondary}
        variant="outlined"
      />
    </View>
  );
}

type FinanceCategoryGroupCardProps = {
  title: string;
  subtitle?: string;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  iconName: AppIconName;
  children: React.ReactNode;
};

export function FinanceCategoryGroupCard({
  title,
  subtitle,
  selected,
  expanded,
  onToggle,
  iconName,
  children,
}: FinanceCategoryGroupCardProps) {
  return (
    <View style={styles.groupCard}>
      <Pressable
        style={styles.groupHeader}
        onPress={onToggle}
        accessibilityRole="button"
      >
        <View style={styles.groupHeaderMain}>
          <View style={styles.groupIconWrap}>
            <AppIcon
              name={iconName}
              size={18}
              color={selected ? FinColors.textPrimary : FinColors.textSecondary}
              variant="outlined"
            />
          </View>
          <View style={styles.groupHeaderTextWrap}>
            <Text style={styles.groupTitle}>{title}</Text>
            {subtitle ? <Text style={styles.groupSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={styles.groupHeaderRight}>
          <FinanceSelectionIndicator selected={selected} size={30} />
          <AppIcon
            name={expanded ? "expand-less" : "expand-more"}
            size={22}
            color={FinColors.textSecondary}
            variant="outlined"
          />
        </View>
      </Pressable>
      {expanded ? <View style={styles.groupChildren}>{children}</View> : null}
    </View>
  );
}

type FinanceCategoryLeafRowProps = {
  label: string;
  selected: boolean;
  iconName: AppIconName;
  onPress: () => void;
  disabled?: boolean;
};

export function FinanceCategoryLeafRow({
  label,
  selected,
  iconName,
  onPress,
  disabled = false,
}: FinanceCategoryLeafRowProps) {
  return (
    <Pressable
      style={[styles.leafRow, selected ? styles.leafRowSelected : null]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <View style={styles.leafRowMain}>
        <View style={styles.leafIconWrap}>
          <AppIcon
            name={iconName}
            size={16}
            color={selected ? FinColors.textPrimary : FinColors.textSecondary}
            variant="outlined"
          />
        </View>
        <Text style={[styles.leafLabel, selected ? styles.leafLabelSelected : null]}>
          {label}
        </Text>
      </View>
      <FinanceSelectionIndicator selected={selected} size={30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    borderRadius: 22,
    backgroundColor: "#f0f1f2",
  },
  flatCardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  flatCardText: {
    flex: 1,
    gap: 4,
  },
  flatCardTitle: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  flatCardDescription: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  flatCardRight: {
    flexShrink: 0,
  },
  flatCardChildren: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  selectionIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndicatorSelected: {
    backgroundColor: "transparent",
  },
  groupCard: {
    borderRadius: 24,
    backgroundColor: "#f0f1f2",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  groupHeaderMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  groupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e7e9ea",
    alignItems: "center",
    justifyContent: "center",
  },
  groupHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  groupTitle: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  groupSubtitle: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  groupHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupChildren: {
    marginTop: 12,
    gap: 8,
  },
  leafRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f7f8f9",
  },
  leafRowSelected: {
    backgroundColor: "#f7f8f9",
  },
  leafRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  leafIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#eef0f1",
    alignItems: "center",
    justifyContent: "center",
  },
  leafLabel: {
    flex: 1,
    minWidth: 0,
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  leafLabelSelected: {
    fontWeight: "800",
  },
});
