import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import {
  ALL_MONTHS_KEY,
  getCurrentMonthKey,
  getMonthOptionByKey,
  type TransactionMonthOption,
} from "@/services/transaction-month-options";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type FinanceMonthSelectorModalProps = {
  visible: boolean;
  monthOptions: TransactionMonthOption[];
  selectedKey: string;
  onClose: () => void;
  onConfirm: (monthKey: string) => void;
  allowAllMonths?: boolean;
  allMonthsLabel?: string;
};

type MonthGridCell = {
  monthIndex: number;
  optionKey: string;
  option: TransactionMonthOption | null;
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => {
  const label = new Intl.DateTimeFormat("nl-NL", { month: "short" }).format(
    new Date(2024, index, 1),
  );
  return label.replace(".", "").replace(/^./, (char) => char.toUpperCase());
});

function getMonthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function resolveMonthOption(year: number, monthIndex: number) {
  return getMonthOptionByKey(getMonthKey(year, monthIndex));
}

export function FinanceMonthSelectorModal({
  visible,
  monthOptions,
  selectedKey,
  onClose,
  onConfirm,
  allowAllMonths = false,
  allMonthsLabel = "Alle maanden",
}: FinanceMonthSelectorModalProps) {
  const currentMonthKey = React.useMemo(() => getCurrentMonthKey(), []);
  const currentMonthOption = React.useMemo(() => getMonthOptionByKey(currentMonthKey), [currentMonthKey]);
  const isAllMonthsSelected = allowAllMonths && selectedKey === ALL_MONTHS_KEY;

  const minYear = React.useMemo(() => {
    if (!monthOptions.length) return new Date().getFullYear();
    return Math.min(...monthOptions.map((option) => option.year));
  }, [monthOptions]);
  const maxYear = React.useMemo(() => {
    if (!monthOptions.length) return new Date().getFullYear();
    return Math.max(...monthOptions.map((option) => option.year));
  }, [monthOptions]);

  const selectedMonth = React.useMemo(() => {
    if (isAllMonthsSelected) return null;
    return getMonthOptionByKey(selectedKey) || getMonthOptionByKey(currentMonthKey);
  }, [currentMonthKey, isAllMonthsSelected, selectedKey]);

  const [draftKey, setDraftKey] = React.useState(selectedKey);
  const [displayYear, setDisplayYear] = React.useState(
    selectedMonth?.year || new Date().getFullYear(),
  );

  React.useEffect(() => {
    if (!visible) return;
    if (allowAllMonths && selectedKey === ALL_MONTHS_KEY) {
      setDraftKey(ALL_MONTHS_KEY);
      setDisplayYear(new Date().getFullYear());
      return;
    }
    const next = getMonthOptionByKey(selectedKey) || selectedMonth;
    if (!next) return;
    setDraftKey(next.key);
    setDisplayYear(next.year);
  }, [allowAllMonths, selectedKey, selectedMonth, visible]);

  const previousMonthOption = React.useMemo(() => {
    if (!currentMonthOption) return null;
    const date = new Date(`${currentMonthOption.startIso}T12:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return getMonthOptionByKey(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }, [currentMonthOption]);

  const canGoToPreviousYear = displayYear > minYear;
  const canGoToNextYear = displayYear < maxYear;

  const quickButtons = [
    ...(allowAllMonths
      ? [
          {
            key: ALL_MONTHS_KEY,
            label: allMonthsLabel,
            monthKey: ALL_MONTHS_KEY,
          },
        ]
      : []),
    {
      key: "current",
      label: "Huidige maand",
      monthKey: currentMonthKey,
    },
    {
      key: "previous",
      label: "Vorige maand",
      monthKey: previousMonthOption?.key || null,
    },
  ] as const;

  const monthRows = React.useMemo(() => {
    const rows: MonthGridCell[][] = [];

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 3) {
      rows.push(
        Array.from({ length: 3 }, (_, offset) => {
          const currentMonthIndex = monthIndex + offset;
          const option = resolveMonthOption(displayYear, currentMonthIndex);
          const optionKey = option?.key || getMonthKey(displayYear, currentMonthIndex);
          return {
            monthIndex: currentMonthIndex,
            optionKey,
            option,
          };
        }),
      );
    }

    return rows;
  }, [displayYear]);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      title="Selecteer maand"
      onClose={onClose}
      bodyStyle={styles.body}
      footerStyle={styles.footer}
      footer={
        <Pressable
          style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmButtonPressed]}
          onPress={() => {
            onConfirm(draftKey || selectedKey);
            onClose();
          }}
        >
          <Text style={styles.confirmButtonText}>Bevestig selectie</Text>
        </Pressable>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.quickRow}>
          {quickButtons.map((button) => {
            const isSelected = button.monthKey === draftKey;
            const disabled = !button.monthKey;

            return (
              <Pressable
                key={button.key}
                disabled={disabled}
                onPress={() => {
                  if (!button.monthKey) return;
                  if (button.monthKey === ALL_MONTHS_KEY) {
                    setDraftKey(ALL_MONTHS_KEY);
                    setDisplayYear(new Date().getFullYear());
                    return;
                  }
                  const option = getMonthOptionByKey(button.monthKey) || currentMonthOption;
                  if (!option) return;
                  setDraftKey(option.key);
                  setDisplayYear(option.year);
                }}
                style={({ pressed }) => [
                  styles.quickButton,
                  isSelected && styles.quickButtonSelected,
                  disabled && styles.quickButtonDisabled,
                  pressed && !disabled && styles.quickButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    isSelected && styles.quickButtonTextSelected,
                  ]}
                >
                  {button.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.yearRow}>
          <Pressable
            disabled={!canGoToPreviousYear}
            onPress={() => canGoToPreviousYear && setDisplayYear((value) => value - 1)}
            style={({ pressed }) => [
              styles.yearArrow,
              !canGoToPreviousYear && styles.yearArrowDisabled,
              pressed && canGoToPreviousYear && styles.yearArrowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Vorig jaar"
          >
            <AppIcon
              name="chevron-left"
              size={26}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          </Pressable>
          <Text style={styles.yearLabel}>{displayYear}</Text>
          <Pressable
            disabled={!canGoToNextYear}
            onPress={() => canGoToNextYear && setDisplayYear((value) => value + 1)}
            style={({ pressed }) => [
              styles.yearArrow,
              !canGoToNextYear && styles.yearArrowDisabled,
              pressed && canGoToNextYear && styles.yearArrowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Volgend jaar"
          >
            <AppIcon
              name="chevron-right"
              size={26}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          </Pressable>
        </View>

        <View style={styles.monthGrid}>
          {monthRows.map((row, rowIndex) => (
            <View key={`month-row-${displayYear}-${rowIndex}`} style={styles.monthGridRow}>
              {row.map(({ monthIndex, option, optionKey }) => {
                const isSelected = draftKey === optionKey;
                const isCurrentMonth = option?.isCurrentMonth || optionKey === currentMonthKey;
                const isFutureMonth =
                  Boolean(option) &&
                  (option!.year > currentMonthOption?.year ||
                    (option!.year === currentMonthOption?.year &&
                      option!.month > (currentMonthOption?.month || 0)));

                return (
                  <Pressable
                    key={optionKey}
                    onPress={() => {
                      const next = option || getMonthOptionByKey(optionKey);
                      if (!next) return;
                      setDraftKey(next.key);
                      setDisplayYear(next.year);
                    }}
                    style={({ pressed }) => [
                      styles.monthCell,
                      isSelected && styles.monthCellSelected,
                      pressed && styles.monthCellPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        isCurrentMonth && styles.monthCellTextCurrent,
                        isFutureMonth && styles.monthCellTextFuture,
                        isSelected && styles.monthCellTextSelected,
                      ]}
                    >
                      {MONTH_LABELS[monthIndex]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </FinanceBottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    justifyContent: "flex-start",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 28,
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.10)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  quickButtonSelected: {
    backgroundColor: FinColors.bgCard,
    borderColor: FinColors.textPrimary,
  },
  quickButtonDisabled: {
    opacity: 0.42,
  },
  quickButtonPressed: {
    opacity: 0.9,
  },
  quickButtonText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  quickButtonTextSelected: {
    color: FinColors.textPrimary,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 999,
    backgroundColor: "#eff1f2",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  yearArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  yearArrowPressed: {
    opacity: 0.82,
  },
  yearArrowDisabled: {
    opacity: 0.24,
  },
  yearLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 21,
    lineHeight: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  monthGrid: {
    gap: 12,
  },
  monthGridRow: {
    flexDirection: "row",
    gap: 12,
  },
  monthCell: {
    flex: 1,
    minHeight: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  monthCellSelected: {
    backgroundColor: FinColors.yellow,
    boxShadow: "0px 12px 24px rgba(242,201,76,0.28)",
    transform: [{ translateY: -1 }],
  },
  monthCellDisabled: {
    opacity: 0.34,
  },
  monthCellPressed: {
    opacity: 0.88,
  },
  monthCellText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: "#5a5d5f",
  },
  monthCellTextCurrent: {
    color: "#4f73b8",
  },
  monthCellTextFuture: {
    color: "#c2c7cb",
  },
  monthCellTextSelected: {
    color: FinColors.textPrimary,
  },
  footer: {
    paddingTop: 6,
  },
  confirmButton: {
    minHeight: 76,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.textPrimary,
    paddingHorizontal: 20,
    boxShadow: "0px 14px 24px rgba(17,17,17,0.16)",
  },
  confirmButtonPressed: {
    opacity: 0.92,
  },
  confirmButtonText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "800",
    color: FinColors.bgCard,
  },
});
