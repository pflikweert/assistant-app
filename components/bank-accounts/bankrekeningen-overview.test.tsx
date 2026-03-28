import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text, View } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BankrekeningenScreen from "@/app/bankrekeningen";

const listBankAccountsMock = vi.hoisted(() => vi.fn());
const getBankAccountTransactionCountMock = vi.hoisted(() => vi.fn());
const markForecastDirtyMock = vi.hoisted(() => vi.fn());

vi.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/components/ui/app-icon", () => ({
  AppIcon: ({ name }: { name: string }) => <Text>{name}</Text>,
}));

vi.mock("@/components/ui/finance-screen-backdrop", () => ({
  FinanceScreenBackdrop: () => <View />,
}));

vi.mock("@/components/ui/finance-detail-top-bar", () => ({
  FinanceDetailTopBar: ({ title }: { title: string }) => <Text>{title}</Text>,
}));

vi.mock("@/components/ui/finance-utility-shell", () => ({
  FinanceUtilityShell: ({
    title,
    children,
  }: {
    title: string;
    children?: React.ReactNode;
  }) => (
    <View>
      <Text>{title}</Text>
      {children}
    </View>
  ),
}));

vi.mock("@/components/ui/finance-bottom-sheet-shell", () => ({
  FinanceBottomSheetShell: ({
    visible,
    title,
    subtitle,
    children,
    footer,
  }: {
    visible: boolean;
    title?: string;
    subtitle?: string;
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <View>
        {title ? <Text>{title}</Text> : null}
        {subtitle ? <Text>{subtitle}</Text> : null}
        {children}
        {footer}
      </View>
    ) : null,
}));

vi.mock("@/components/bank-accounts/bank-account-form-sheet", () => ({
  BankAccountFormSheet: ({ visible, mode }: { visible: boolean; mode: string }) =>
    visible ? <Text>{`sheet-${mode}`}</Text> : null,
}));

vi.mock("@/services/forecast-refresh", () => ({
  markForecastDirty: markForecastDirtyMock,
}));

vi.mock("@/services/bank-accounts", () => ({
  listBankAccounts: listBankAccountsMock,
  getBankAccountTransactionCount: getBankAccountTransactionCountMock,
  deleteBankAccountWithTransactions: vi.fn(),
}));

function flattenText(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenText(item));
  return flattenText((value as { children?: unknown }).children);
}

function getAllText(tree: renderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .flatMap((node) => flattenText(node.props.children))
    .join(" ");
}

describe("bankrekeningen-overzicht", () => {
  beforeEach(() => {
    listBankAccountsMock.mockReset();
    getBankAccountTransactionCountMock.mockReset();
    markForecastDirtyMock.mockReset();
  });

  it("toont rustige samenvatting zonder technische badge-overload", async () => {
    listBankAccountsMock.mockResolvedValue([
      {
        id: "acc_1",
        name: "Betaalrekening Pieter",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
        include_in_budget: true,
        include_in_cashflow: true,
        include_in_net_worth: true,
        owner_scope: "personal",
        forecast_role: "operational",
      },
      {
        id: "acc_2",
        name: "Gezamenlijke spaarrekening",
        account_type: "savings",
        provider: "ING",
        currency: "EUR",
        account_masked: null,
        is_active: true,
        include_in_budget: false,
        include_in_cashflow: false,
        include_in_net_worth: true,
        owner_scope: "shared",
        forecast_role: "reserve",
      },
    ]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BankrekeningenScreen />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = getAllText(tree);
    expect(text).toContain("Gebruikt voor budget en vermogen");
    expect(text).toContain("Gedeelde overzichtsrekening");
    expect(text).toContain("Rekeningnummer niet bekend");
    expect(text).toContain("Samen");
    expect(text).not.toContain("Geldcontext");
    expect(text).not.toContain("Cashflow");
    expect(text).not.toContain("Vermogen");
    expect(text).not.toContain("Rol");
  });

  it("houdt bewerken en verwijderen acties beschikbaar", async () => {
    listBankAccountsMock.mockResolvedValue([
      {
        id: "acc_1",
        name: "Betaalrekening Pieter",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
        include_in_budget: true,
      },
    ]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BankrekeningenScreen />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const actionButtons = tree.root.findAll(
      (node) => node.type === Pressable && Boolean(node.props.accessibilityLabel),
    );
    const editButton = actionButtons.find(
      (node) => node.props.accessibilityLabel === "Rekening bewerken",
    );
    const deleteButton = actionButtons.find(
      (node) => node.props.accessibilityLabel === "Rekening verwijderen",
    );

    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();

    await act(async () => {
      editButton?.props.onPress();
    });
    expect(getAllText(tree)).toContain("sheet-edit");

    await act(async () => {
      deleteButton?.props.onPress();
    });
    expect(getAllText(tree)).toContain("Rekening verwijderen");
  });
});
