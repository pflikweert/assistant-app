import { BankAccountFormSheet } from "@/components/bank-accounts/bank-account-form-sheet";
import type { BankAccount } from "@/services/bank-accounts";

type ImportBankAccountSheetProps = {
  visible: boolean;
  providerLabel: string;
  sourceAccountNumber: string | null;
  sourceAccountLabel: string;
  onClose: () => void;
  onCreated: (account: BankAccount) => void;
};

export function ImportBankAccountSheet({
  visible,
  providerLabel,
  sourceAccountNumber,
  sourceAccountLabel,
  onClose,
  onCreated,
}: ImportBankAccountSheetProps) {
  return (
    <BankAccountFormSheet
      visible={visible}
      mode="create"
      title="Nieuwe rekening"
      subtitle="Maak een bankrekening aan en koppel die meteen aan deze bronrekening."
      providerLabel={providerLabel}
      sourceAccountNumber={sourceAccountNumber}
      sourceAccountLabel={sourceAccountLabel}
      showSourceInfo
      onClose={onClose}
      onSaved={onCreated}
    />
  );
}
