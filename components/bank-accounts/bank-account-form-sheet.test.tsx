import React from "react";
import renderer, { act } from "react-test-renderer";
import { Switch, Text, TextInput, View } from "react-native";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  BankAccountFormSheet,
  buildBankAccountFormInitialMeaning,
  buildLiveSummaryText,
  resolveDefaultsForCreate,
} from "./bank-account-form-sheet";

const createBankAccountMock = vi.hoisted(() => vi.fn());
const updateBankAccountMock = vi.hoisted(() => vi.fn());

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  const MockTextInput = (props: any) => <View {...props} />;
  return {
    ...actual,
    TextInput: MockTextInput,
  };
});

vi.mock("@/components/ui/app-icon", () => ({
  AppIcon: () => <Text>icon</Text>,
}));

vi.mock("@/components/ui/finance-bottom-sheet-shell", () => ({
  FinanceBottomSheetShell: ({
    children,
    footer,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <View>
      {children}
      {footer}
    </View>
  ),
}));

vi.mock("@/services/bank-accounts", async () => {
  return {
    ACCOUNT_TYPES: ["checking", "savings", "credit", "loan", "investment", "cash", "other"],
    createBankAccount: createBankAccountMock,
    updateBankAccount: updateBankAccountMock,
  };
});

function flattenText(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenText(item));
  }
  return flattenText((value as { children?: unknown }).children);
}

function findPressableByText(root: renderer.ReactTestRenderer["root"], text: string) {
  const match = root.findAllByType(Text).find((node) => {
    const content = flattenText(node.props.children).join("").trim();
    return content === text;
  });
  if (!match) throw new Error(`Text not found: ${text}`);

  let cursor: any = match.parent;
  while (cursor && typeof cursor.props?.onPress !== "function") {
    cursor = cursor.parent;
  }
  if (!cursor) throw new Error(`No pressable found for text: ${text}`);
  return cursor as renderer.ReactTestInstance;
}

function buildEditAccount() {
  return {
    id: "acc_1",
    name: "Betaalrekening Pieter",
    account_type: "checking" as const,
    provider: "Rabobank",
    currency: "EUR",
    account_masked: "************9805",
    is_active: true,
    include_in_budget: true,
    include_in_net_worth: true,
    include_in_cashflow: true,
    owner_scope: "personal" as const,
    forecast_role: "operational" as const,
  };
}

describe("bank-account-form-sheet", () => {
  beforeEach(() => {
    createBankAccountMock.mockReset();
    updateBankAccountMock.mockReset();
  });

  it("gebruikt verstandige create defaults voor betaal- en spaarrekening", () => {
    const checking = resolveDefaultsForCreate("checking");
    const savings = resolveDefaultsForCreate("savings");

    expect(checking.owner_scope).toBe("personal");
    expect(checking.include_in_budget).toBe(true);
    expect(checking.include_in_cashflow).toBe(true);
    expect(checking.include_in_net_worth).toBe(true);

    expect(savings.owner_scope).toBe("personal");
    expect(savings.include_in_budget).toBe(false);
    expect(savings.include_in_cashflow).toBe(false);
    expect(savings.include_in_net_worth).toBe(true);
  });

  it("laadt bestaande waarden in edit-mode via dezelfde semantiek", () => {
    const account = buildEditAccount();
    const initialMeaning = buildBankAccountFormInitialMeaning({
      mode: "edit",
      accountType: account.account_type,
      account,
    });

    expect(initialMeaning.owner_scope).toBe("personal");
    expect(initialMeaning.include_in_budget).toBe(true);
    expect(initialMeaning.include_in_net_worth).toBe(true);
    expect(initialMeaning.include_in_cashflow).toBe(true);
    expect(initialMeaning.forecast_role).toBe("operational");
  });

  it("past de live samenvatting aan op basis van gekozen instellingen", () => {
    const text = buildLiveSummaryText({
      ownerScope: "shared",
      includeInBudget: true,
      includeInNetWorth: true,
      includeInCashflow: false,
      forecastRole: "shared",
    });

    expect(text).toContain("rekening (samen)");
    expect(text).toContain("budgetten");
    expect(text).toContain("totale vermogen");
    expect(text).not.toContain("vooruitzichten");
  });

  it("maakt een nieuwe rekening aan met spaarrekening-defaults en eigenaarsscope", async () => {
    createBankAccountMock.mockResolvedValue({
      ...buildEditAccount(),
      id: "acc_2",
      account_type: "savings",
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: true,
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BankAccountFormSheet
          visible
          mode="create"
          onSaved={onSaved}
          onClose={onClose}
          sourceAccountNumber="NL01RABO0123456789"
          providerLabel="Rabobank"
        />,
      );
    });

    const inputs = tree.root.findAllByType(TextInput);
    await act(async () => {
      inputs[0]?.props.onChangeText("Spaarrekening");
      inputs[1]?.props.onChangeText("Rabobank");
      inputs[2]?.props.onChangeText("NL01RABO0123456789");
    });

    await act(async () => {
      findPressableByText(tree.root, "Betaalrekening").props.onPress();
    });
    await act(async () => {
      findPressableByText(tree.root, "Spaarrekening").props.onPress();
    });
    await act(async () => {
      findPressableByText(tree.root, "Rekening aanmaken").props.onPress();
    });

    expect(createBankAccountMock).toHaveBeenCalledTimes(1);
    expect(createBankAccountMock.mock.calls[0]?.[0]).toMatchObject({
      name: "Spaarrekening",
      accountType: "savings",
      ownerScope: "personal",
      includeInBudget: false,
      includeInNetWorth: true,
      includeInCashflow: false,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("houdt geavanceerde opties optioneel en laat verwijderen intact in edit flow", async () => {
    updateBankAccountMock.mockResolvedValue(buildEditAccount());
    const onDelete = vi.fn();

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BankAccountFormSheet
          visible
          mode="edit"
          account={buildEditAccount()}
          onSaved={vi.fn()}
          onClose={vi.fn()}
          showActiveToggle
          onDelete={onDelete}
        />,
      );
    });

    const textBefore = tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" ");
    expect(textBefore).not.toContain("Rol in forecast");

    await act(async () => {
      findPressableByText(tree.root, "Geavanceerde opties").props.onPress();
    });

    const textAfter = tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" ");
    expect(textAfter).toContain("Rol in forecast");

    const switches = tree.root.findAllByType(Switch);
    await act(async () => {
      switches[0]?.props.onValueChange(false);
      switches[1]?.props.onValueChange(false);
      switches[2]?.props.onValueChange(false);
    });

    await act(async () => {
      findPressableByText(tree.root, "Rekening verwijderen").props.onPress();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
