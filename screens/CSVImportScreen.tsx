import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// @ts-ignore
import { FinColors } from "@/constants/theme";
import { runCategorizationInBackground } from "@/services/categorization";
import {
  ACCOUNT_TYPES,
  type BankAccount,
  type BankAccountType,
  createBankAccount,
  findBankAccountByHash,
  hashAccountNumber,
  listBankAccounts,
  maskAccountNumber,
  normalizeAccountNumber,
} from "@/services/bank-accounts";
import { requireCurrentUserId } from "@/services/current-user";
import {
  ImportSource,
  parseTransactionImport,
  TransactionImportRecord,
} from "@/services/import/transaction-import-parser";
import { supabase } from "@/services/supabase";
import { normalizeTransactionDetails } from "@/services/transaction-details";

type PreviewRow = { date: string; description: string; amount: string };

export default function CSVImportScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const [insertedCount, setInsertedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [pendingRowCount, setPendingRowCount] = useState<number | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<ImportSource>("csv");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newAccountType, setNewAccountType] =
    useState<BankAccountType>("checking");
  const [newAccountProvider, setNewAccountProvider] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [detectedAccountNumber, setDetectedAccountNumber] =
    useState<string | null>(null);
  const selectedAccount = React.useMemo(
    () => bankAccounts.find((account) => account.id === selectedAccountId) ?? null,
    [bankAccounts, selectedAccountId],
  );

  // Prevent leaving during import
  React.useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (loading) {
        e.preventDefault();
        Alert.alert("Importing", "Please wait until the import finishes.");
      }
    });
    return unsub;
  }, [navigation, loading]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: loading ? () => null : undefined });
  }, [navigation, loading]);

  const loadBankAccounts = React.useCallback(async () => {
    try {
      const rows = await listBankAccounts();
      setBankAccounts(rows);
      setSelectedAccountId((current) => {
        if (current) return current;
        if (rows.length === 1) return rows[0].id;
        return current;
      });
    } catch (error) {
      console.warn("[csv-import] bank account load error", error);
    }
  }, []);

  React.useEffect(() => {
    void loadBankAccounts();
  }, [loadBankAccounts]);

  const detectAccountFromRecord = React.useCallback(async (record: TransactionImportRecord | null) => {
    if (!record) {
      setDetectedAccountNumber(null);
      return;
    }
    const candidate =
      record.metadata["Tegenrekening IBAN/BBAN"] ||
      record.metadata["IBAN"] ||
      record.metadata["Rekeningnummer"] ||
      record.metadata["Rekening"] ||
      record.metadata["Rekening nummer"] ||
      record.counterparty;
    const normalized = normalizeAccountNumber(candidate);
    if (!normalized) {
      setDetectedAccountNumber(null);
      return;
    }
    setDetectedAccountNumber(normalized);
    setNewAccountNumber(normalized);
    setNewAccountName((current) => current || `Import ${normalized.slice(-4)}`);
    try {
      const hash = await hashAccountNumber(normalized);
      const existing = await findBankAccountByHash(hash);
      if (existing) {
        setSelectedAccountId(existing.id);
      }
    } catch (error) {
      console.warn("[csv-import] detect account", error);
    }
  }, []);

  const handleAddBankAccount = async () => {
    const name = newAccountName.trim();
    if (!name) {
      Alert.alert("Naam verplicht", "Geef de rekening een herkenbare naam.");
      return;
    }
    setCreatingAccount(true);
    try {
      const created = await createBankAccount({
        name,
        accountNumber: newAccountNumber || null,
        accountType: newAccountType,
        provider: newAccountProvider.trim() || null,
      });
      await loadBankAccounts();
      setSelectedAccountId(created.id);
      setNewAccountName("");
      setNewAccountNumber("");
      setNewAccountProvider("");
      setDetectedAccountNumber(null);
    } catch (error: any) {
      const msg = error?.message || "Kon de rekening niet opslaan.";
      Alert.alert("Error", msg);
    } finally {
      setCreatingAccount(false);
    }
  };


  const toBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const buildPreview = (
    source: ImportSource,
    content: string,
  ): {
    previewRows: PreviewRow[];
    rowCount: number;
    sampleRecord: TransactionImportRecord | null;
  } => {
    const rows = parseTransactionImport(source, content);
    const sampleRecord = rows[0] || null;
    return {
      rowCount: rows.length,
      previewRows: rows.slice(0, 5).map((r) => ({
        date: r.date || "—",
        description: r.details || r.counterparty || "—",
        amount: Number.isFinite(r.amount) ? String(r.amount) : "—",
      })),
      sampleRecord,
    };
  };

  const pickFile = async () => {
    setMessage(null);
    setSuccess(false);
    setTotal(null);
    setProcessed(0);
    setInsertedCount(0);
    setUpdatedCount(0);
    setPreview([]);
    setPendingRowCount(null);
    setPendingContent(null);

    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept =
        importSource === "pdf"
          ? ".pdf,application/pdf"
          : ".csv,text/csv";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const content =
          importSource === "pdf"
            ? toBase64(new Uint8Array(await file.arrayBuffer()))
            : await file.text();

        const { previewRows, rowCount, sampleRecord } = buildPreview(
          importSource,
          content,
        );
        setPreview(previewRows);
        setPendingRowCount(rowCount);
        setPendingContent(content);
        setMessage(null);
        void detectAccountFromRecord(sampleRecord);
      };
      input.click();
      return;
    }
    try {
      const pickerType =
        importSource === "pdf"
          ? ["application/pdf", ".pdf"]
          : ["text/csv", ".csv"];
      const res: any = await DocumentPicker.getDocumentAsync({ type: pickerType });
      if (res.type === "cancel") return;
      if (res?.uri) {
        const content = await FileSystem.readAsStringAsync(res.uri, {
          encoding:
            importSource === "pdf"
              ? "base64"
              : "utf8",
        });
        const { previewRows, rowCount, sampleRecord } = buildPreview(
          importSource,
          content,
        );
        setPreview(previewRows);
        setPendingRowCount(rowCount);
        setPendingContent(content);
        setMessage(null);
        void detectAccountFromRecord(sampleRecord);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const doImport = async () => {
    if (!pendingContent) return;
    if (!selectedAccount) {
      Alert.alert(
        "Selecteer een rekening",
        "Kies of maak eerst een rekening aan voordat je importeert.",
      );
      return;
    }
    setLoading(true);
    setSuccess(false);
    setMessage("Importeren...");
    await Promise.resolve();
    try {
      await handleImportContent(pendingContent, selectedAccount.id);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setMessage(`Import failed: ${msg}`);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  async function handleImportContent(content: string, bankAccountId: string) {
    const userId = await requireCurrentUserId();
    const rows = parseTransactionImport(importSource, content);
    setTotal(rows.length);
    setProcessed(0);
    setInsertedCount(0);
    setUpdatedCount(0);
    let imported = 0;
    let insertedRows = 0;
    let updated = 0;
    const importedIds: string[] = [];

    for (const tx of rows) {
      const normalizedDetails = normalizeTransactionDetails(tx.details);
      setMessage(
        `Verwerken ${imported + 1} / ${rows.length}... (${insertedRows} nieuw, ${updated} bijgewerkt)`,
      );
      const { data: existing, error: selErr } = await supabase
        .from("transactions")
        .select("id,details,counterparty")
        .eq("user_id", userId)
        .eq("bank_account_id", bankAccountId)
        .eq("date", tx.date)
        .eq("amount", tx.amount)
        .limit(25);
      if (selErr) throw selErr;
      const existingMatch =
        existing?.find(
          (row) =>
            normalizeTransactionDetails(row.details) === normalizedDetails &&
            String(row.counterparty || "").trim() ===
              String(tx.counterparty || "").trim(),
        ) ||
        existing?.find(
          (row) => normalizeTransactionDetails(row.details) === normalizedDetails,
        );
      const payload: any = {
        user_id: userId,
        bank_account_id: bankAccountId,
        date: tx.date,
        details: normalizedDetails,
        counterparty: tx.counterparty,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        metadata: {
          ...(tx.metadata || {}),
          source: importSource,
        },
      };
      if (existingMatch?.id) {
        const { error: updErr } = await supabase
          .from("transactions")
          .update(payload)
          .eq("user_id", userId)
          .eq("bank_account_id", bankAccountId)
          .eq("id", existingMatch.id);
        if (updErr) throw updErr;
        importedIds.push(existingMatch.id);
        updated += 1;
        setUpdatedCount(updated);
      } else {
        const { data: insertedRow, error: insErr } = await supabase
          .from("transactions")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) throw insErr;
        if (insertedRow?.id) importedIds.push(insertedRow.id);
        insertedRows += 1;
        setInsertedCount(insertedRows);
      }
      imported++;
      setProcessed(imported);
    }
    setSuccess(true);
    setMessage(
      `${imported} transacties verwerkt: ${insertedRows} nieuw, ${updated} bijgewerkt. Categorisatie is op de achtergrond gestart.`,
    );
    runCategorizationInBackground(importedIds);
    setPendingContent(null);
  }


  const pct = total ? Math.round((processed / total) * 100) : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Import Bank Transactions</Text>
      <Text style={styles.subtitle}>
        Upload a Rabobank CSV/PDF export to sync your transactions.
      </Text>

      <View style={styles.sourceSwitchRow}>
        {(["csv", "pdf"] as ImportSource[]).map((source) => {
          const selected = importSource === source;
          return (
            <TouchableOpacity
              key={source}
              style={[styles.sourceSwitchBtn, selected && styles.sourceSwitchBtnSelected]}
              onPress={() => {
                setImportSource(source);
                setPendingContent(null);
                setPendingRowCount(null);
                setPreview([]);
                setDetectedAccountNumber(null);
              }}
            >
              <Text
                style={[
                  styles.sourceSwitchText,
                  selected && styles.sourceSwitchTextSelected,
                ]}
              >
                {source.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.accountSection}>
        <Text style={styles.sectionTitle}>Rekeningcontext</Text>
        {bankAccounts.length ? (
          <View style={styles.accountListRow}>
            {bankAccounts.map((account) => {
              const isSelected = account.id === selectedAccountId;
              return (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountPill,
                    isSelected && styles.accountPillSelected,
                  ]}
                  onPress={() => setSelectedAccountId(account.id)}
                >
                  <Text
                    style={[
                      styles.accountPillName,
                      isSelected && styles.accountPillNameSelected,
                    ]}
                  >
                    {account.name}
                  </Text>
                  <Text style={styles.accountPillMeta}>
                    {account.account_type} ·{" "}
                    {account.account_masked ?? account.currency}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.hintText}>
            Geen rekeningen gevonden, voeg hieronder een rekening toe.
          </Text>
        )}
        {selectedAccount && (
          <Text style={styles.selectedAccountText}>
            Geselecteerd: {selectedAccount.name} ·{" "}
            {selectedAccount.account_masked ?? selectedAccount.currency}
          </Text>
        )}
        {!selectedAccount && detectedAccountNumber && (
          <Text style={styles.detectedLabel}>
            {importSource.toUpperCase()} bevat rekening {maskAccountNumber(detectedAccountNumber)}.
          </Text>
        )}
      </View>

      <View style={styles.accountForm}>
        <Text style={styles.sectionTitle}>Nieuwe rekening toevoegen</Text>
        <TextInput
          value={newAccountName}
          onChangeText={setNewAccountName}
          placeholder="Naam voor deze rekening"
          style={styles.textInput}
        />
        <TextInput
          value={newAccountNumber}
          onChangeText={setNewAccountNumber}
          placeholder="IBAN of rekeningnummer"
          style={styles.textInput}
        />
        <TextInput
          value={newAccountProvider}
          onChangeText={setNewAccountProvider}
          placeholder="Provider (optioneel)"
          style={styles.textInput}
        />
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.accountTypeList}>
          {ACCOUNT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.accountTypePill,
                newAccountType === type && styles.accountTypePillSelected,
              ]}
              onPress={() => setNewAccountType(type)}
            >
              <Text
                style={[
                  styles.accountTypeText,
                  newAccountType === type && styles.accountTypeTextSelected,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[
            styles.createAccountBtn,
            creatingAccount && styles.importBtnDisabled,
          ]}
          disabled={creatingAccount}
          onPress={handleAddBankAccount}
        >
          <Text style={styles.createAccountBtnText}>
            {creatingAccount ? "Rekening opslaan..." : "Rekening toevoegen"}
          </Text>
        </TouchableOpacity>
      </View>



      {/* Upload card */}
      <TouchableOpacity
        style={[styles.uploadCard, pendingContent && styles.uploadCardReady]}
        onPress={loading ? undefined : pickFile}
        activeOpacity={0.75}
      >
        <View style={styles.uploadIconWrap}>
          <Text style={{ fontSize: 28, color: FinColors.green }}>↑</Text>
        </View>
        <Text style={styles.uploadLabel}>Upload Rabobank CSV/PDF</Text>
        <Text style={styles.uploadHint}>
          {pendingContent
            ? "File selected — review below"
            : `Tap to select a ${importSource === "pdf" ? ".pdf" : ".csv"} file`}
        </Text>
        <View style={styles.uploadBtn}>
          <Text style={styles.uploadBtnText}>
            {pendingContent
              ? "Change file"
              : `Select ${importSource.toUpperCase()} file`}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Preview table */}
      {preview.length > 0 && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Preview</Text>
          {pendingRowCount != null ? (
            <Text style={styles.previewSummary}>
              {pendingRowCount} rijen gevonden in {importSource.toUpperCase()}
            </Text>
          ) : null}
          {/* Header */}
          <View style={[styles.previewRow, styles.previewHeaderRow]}>
            <Text
              style={[styles.previewCell, styles.previewHeader, { flex: 1.2 }]}
            >
              Date
            </Text>
            <Text
              style={[styles.previewCell, styles.previewHeader, { flex: 3 }]}
            >
              Description
            </Text>
            <Text
              style={[
                styles.previewCell,
                styles.previewHeader,
                { flex: 1.5, textAlign: "right" },
              ]}
            >
              Amount
            </Text>
          </View>
          {preview.map((row, i) => (
            <View
              key={i}
              style={[styles.previewRow, i % 2 === 0 && styles.previewRowAlt]}
            >
              <Text style={[styles.previewCell, { flex: 1.2 }]}>
                {row.date}
              </Text>
              <Text style={[styles.previewCell, { flex: 3 }]} numberOfLines={1}>
                {row.description}
              </Text>
              <Text
                style={[styles.previewCell, { flex: 1.5, textAlign: "right" }]}
              >
                {row.amount}
              </Text>
            </View>
          ))}
          <Text style={styles.previewNote}>
            Eerste {preview.length} rijen van{" "}
            {pendingRowCount ?? preview.length}
          </Text>
        </View>
      )}

      {/* Progress */}
      {loading && total != null && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <ActivityIndicator color={FinColors.green} size="small" />
            <Text style={styles.progressText}>{message}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${pct}%` as any }]}
            />
          </View>
          <View style={styles.progressStatsRow}>
            <Text style={styles.progressStatText}>Nieuw: {insertedCount}</Text>
            <Text style={styles.progressStatText}>
              Bijgewerkt: {updatedCount}
            </Text>
          </View>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
      )}

      {/* Success */}
      {success && (
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>{message}</Text>
        </View>
      )}

      {/* Error (non-success message) */}
      {message && !loading && !success && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{message}</Text>
        </View>
      )}

      {/* Import button */}
      {pendingContent && !loading && (
        <TouchableOpacity style={styles.importBtn} onPress={doImport}>
          <Text style={styles.importBtnText}>Import Transactions</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  content: { padding: 24, paddingTop: 12, gap: 16 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: FinColors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: FinColors.textMuted,
    marginBottom: 8,
    lineHeight: 20,
  },
  sourceSwitchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  sourceSwitchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: FinColors.bgCard,
  },
  sourceSwitchBtnSelected: {
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.warningBg,
  },
  sourceSwitchText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textMuted,
  },
  sourceSwitchTextSelected: {
    color: FinColors.warningText,
  },

  accountSection: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  accountListRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accountPill: {
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    minWidth: 130,
  },
  accountPillSelected: {
    borderColor: FinColors.green,
    backgroundColor: FinColors.greenBg,
  },
  accountPillName: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  accountPillNameSelected: {
    color: FinColors.green,
  },
  accountPillMeta: {
    fontSize: 11,
    color: FinColors.textMuted,
  },
  hintText: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  selectedAccountText: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  detectedLabel: {
    fontSize: 11,
    color: FinColors.textMuted,
  },

  uploadCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: FinColors.borderSubtle,
    borderStyle: "dashed",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  uploadCardReady: {
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.warningBg,
  },
  uploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FinColors.warningBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  uploadLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  uploadHint: { fontSize: 12, color: FinColors.textMuted, textAlign: "center" },
  uploadBtn: {
    marginTop: 8,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },

  previewCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.textPrimary,
    marginBottom: 10,
  },
  previewSummary: {
    fontSize: 12,
    color: FinColors.textSecondary,
    marginBottom: 10,
  },
  previewRow: { flexDirection: "row", paddingVertical: 7 },
  previewRowAlt: { backgroundColor: "rgba(17,17,17,0.03)", borderRadius: 8 },
  previewHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    marginBottom: 4,
  },
  previewCell: { fontSize: 11, color: FinColors.textSecondary },
  previewHeader: {
    fontWeight: "700",
    color: FinColors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
  },
  previewNote: {
    fontSize: 10,
    color: FinColors.textMuted,
    marginTop: 8,
    textAlign: "right",
  },
  accountForm: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    marginBottom: 12,
    gap: 10,
  },
  textInput: {
    backgroundColor: FinColors.bgInput,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    color: FinColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  accountTypeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  accountTypePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
  },
  accountTypePillSelected: {
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.warningBg,
  },
  accountTypeText: {
    fontSize: 12,
    color: FinColors.textPrimary,
  },
  accountTypeTextSelected: {
    color: FinColors.warningText,
  },
  createAccountBtn: {
    marginTop: 8,
    backgroundColor: FinColors.yellow,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  createAccountBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  importBtnDisabled: {
    opacity: 0.6,
  },

  progressCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressText: { fontSize: 12, color: FinColors.textSecondary, flex: 1 },
  progressBarBg: {
    height: 4,
    backgroundColor: FinColors.bgInput,
    borderRadius: 4,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: FinColors.warningText,
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 11,
    color: FinColors.warningText,
    fontWeight: "700",
    textAlign: "right",
  },
  progressStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  progressStatText: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "600",
  },

  successCard: {
    backgroundColor: FinColors.warningBg,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  successIcon: { fontSize: 20, color: FinColors.warningText },
  successText: {
    fontSize: 14,
    fontWeight: "600",
    color: FinColors.warningText,
    flex: 1,
  },

  errorCard: {
    backgroundColor: FinColors.redBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  errorText: { fontSize: 13, color: FinColors.red },

  importBtn: {
    backgroundColor: FinColors.textPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  importBtnText: { fontSize: 15, fontWeight: "700", color: FinColors.bgBase },
});
