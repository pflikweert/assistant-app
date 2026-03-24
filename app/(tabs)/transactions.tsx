import { useLocalSearchParams } from "expo-router";
import React from "react";
import TransactionsScreen from "../../screens/TransactionsScreen";

function normalizeParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function TransactionsTabEntry() {
  const {
    counterparty,
    analysisCategory,
    analysisMainGroup,
    monthStart,
    monthEndExclusive,
    categoryKey,
  } = useLocalSearchParams<{
    counterparty?: string;
    analysisCategory?: string;
    analysisMainGroup?: "income" | "expense";
    monthStart?: string;
    monthEndExclusive?: string;
    categoryKey?: string;
  }>();

  return (
    <TransactionsScreen
      counterpartyFilter={normalizeParam(counterparty)}
      analysisCategoryFilter={normalizeParam(analysisCategory)}
      analysisMainGroupFilter={normalizeParam(analysisMainGroup) as "income" | "expense" | undefined}
      monthStartFilter={normalizeParam(monthStart)}
      monthEndExclusiveFilter={normalizeParam(monthEndExclusive)}
      categoryKeyFilter={normalizeParam(categoryKey)}
      showQuickMenu={false}
    />
  );
}
