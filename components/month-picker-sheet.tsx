import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import {
  groupMonthOptionsByYear,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function MonthPickerSheet({
  visible,
  title = "Kies maand",
  helper = "Alleen maanden met transacties",
  pinnedOptions,
  options,
  selectedKey,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title?: string;
  helper?: string;
  pinnedOptions?: { key: string; label: string; meta?: string }[];
  options: TransactionMonthOption[];
  selectedKey: string | null;
  onClose: () => void;
  onSelect: (monthKey: string) => void;
}) {
  const groups = React.useMemo(() => groupMonthOptionsByYear(options), [options]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.helper}>{helper}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <AppIcon
                name="close"
                size={18}
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
            {pinnedOptions && pinnedOptions.length ? (
              <View style={styles.pinnedBlock}>
                {pinnedOptions.map((option) => {
                  const selected = option.key === selectedKey;
                  return (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.pinnedOption,
                        selected && styles.pinnedOptionActive,
                      ]}
                      onPress={() => {
                        onSelect(option.key);
                        onClose();
                      }}
                    >
                      <Text
                        style={[
                          styles.pinnedOptionText,
                          selected && styles.pinnedOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.meta ? (
                        <Text
                          style={[
                            styles.pinnedOptionMeta,
                            selected && styles.pinnedOptionMetaActive,
                          ]}
                        >
                          {option.meta}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {groups.map((group) => (
              <View key={String(group.year)} style={styles.yearBlock}>
                <Text style={styles.yearLabel}>{group.year}</Text>
                <View style={styles.monthGrid}>
                  {group.months.map((option) => {
                    const selected = option.key === selectedKey;
                    return (
                      <Pressable
                        key={option.key}
                        style={[
                          styles.monthChip,
                          selected && styles.monthChipActive,
                        ]}
                        onPress={() => {
                          onSelect(option.key);
                          onClose();
                        }}
                      >
                        <Text
                          style={[
                            styles.monthChipText,
                            selected && styles.monthChipTextActive,
                          ]}
                        >
                          {option.monthLabel}
                        </Text>
                        {option.isCurrentMonth ? (
                          <Text
                            style={[
                              styles.monthChipMeta,
                              selected && styles.monthChipMetaActive,
                            ]}
                          >
                            Nu
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.24)",
  },
  sheet: {
    maxHeight: "82%",
    backgroundColor: FinColors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: FinColors.border,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerMain: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  helper: {
    marginTop: 4,
    fontSize: 13,
    color: FinColors.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  scroll: {
    marginTop: 18,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  pinnedBlock: {
    marginBottom: 18,
  },
  pinnedOption: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "center",
  },
  pinnedOptionActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  pinnedOptionText: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  pinnedOptionTextActive: {
    color: FinColors.bgCard,
  },
  pinnedOptionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: FinColors.textSecondary,
  },
  pinnedOptionMetaActive: {
    color: FinColors.bgCard,
    opacity: 0.76,
  },
  yearBlock: {
    marginBottom: 18,
  },
  yearLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    justifyContent: "space-between",
  },
  monthChip: {
    width: "31%",
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
    marginBottom: 10,
  },
  monthChipActive: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  monthChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
    textTransform: "capitalize",
  },
  monthChipTextActive: {
    color: FinColors.bgCard,
  },
  monthChipMeta: {
    marginTop: 4,
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  monthChipMetaActive: {
    color: FinColors.bgCard,
    opacity: 0.72,
  },
});
