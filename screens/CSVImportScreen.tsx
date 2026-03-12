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
    TouchableOpacity,
    View,
} from "react-native";
// @ts-ignore
import { FinColors } from "@/constants/theme";
import { runCategorizationInBackground } from "@/services/categorization";
import { supabase } from "@/services/supabase";
import Papa from "papaparse";

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
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);

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

  const buildPreview = (
    csv: string,
  ): { previewRows: PreviewRow[]; rowCount: number } => {
    const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = (data as any[]) || [];
    return {
      rowCount: rows.length,
      previewRows: rows.slice(0, 5).map((r: any) => ({
        date: r["Datum"] || r.Date || "—",
        description:
          r["Omschrijving-1"] ||
          r["Naam tegenpartij"] ||
          r["Naam / Omschrijving"] ||
          "—",
        amount: r["Bedrag"] || r.Amount || "—",
      })),
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
    setPendingCsv(null);

    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const text = await file.text();
        const { previewRows, rowCount } = buildPreview(text);
        setPreview(previewRows);
        setPendingRowCount(rowCount);
        setPendingCsv(text);
        setMessage(null);
      };
      input.click();
      return;
    }
    try {
      const res: any = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (res.type === "cancel") return;
      if (res?.uri) {
        const text = await FileSystem.readAsStringAsync(res.uri);
        const { previewRows, rowCount } = buildPreview(text);
        setPreview(previewRows);
        setPendingRowCount(rowCount);
        setPendingCsv(text);
        setMessage(null);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const doImport = async () => {
    if (!pendingCsv) return;
    setLoading(true);
    setSuccess(false);
    setMessage("Importeren...");
    await Promise.resolve();
    try {
      await handleCsvContent(pendingCsv);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setMessage(`Import failed: ${msg}`);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  async function handleCsvContent(csv: string) {
    const { data, errors } = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    if (errors.length) {
      console.warn("[v0] CSV parse errors", errors);
    }

    type Row = Record<string, string>;
    const rows = (data as Row[]).map((r) => {
      const date = r["Datum"] || r.Date;
      const amountRaw = r["Bedrag"] || r.Amount || "0";
      const amount = parseFloat(amountRaw.replace(",", ".")) || 0;
      const currency = r["Munt"] || r.Currency;
      const descParts: string[] = [];
      if (r["Omschrijving-1"]) descParts.push(r["Omschrijving-1"]);
      if (r["Omschrijving-2"]) descParts.push(r["Omschrijving-2"]);
      if (r["Omschrijving-3"]) descParts.push(r["Omschrijving-3"]);
      if (r["Naam tegenpartij"]) descParts.push(r["Naam tegenpartij"]);
      if (r["Naam / Omschrijving"]) descParts.push(r["Naam / Omschrijving"]);
      const description = descParts.filter(Boolean).join(" | ");
      const counterparty =
        r["Naam tegenpartij"] ||
        r["Naam uiteindelijke partij"] ||
        r["Tegenrekening IBAN/BBAN"];
      const type = r["Code"] || r["Type"];
      const metadata: Record<string, string> = {};
      Object.entries(r).forEach(([k, v]) => {
        if (
          ![
            "Datum",
            "Bedrag",
            "Munt",
            "Omschrijving-1",
            "Omschrijving-2",
            "Omschrijving-3",
            "Naam tegenpartij",
            "Naam uiteindelijke partij",
            "Tegenrekening IBAN/BBAN",
            "Naam / Omschrijving",
            "Code",
            "Type",
          ].includes(k)
        ) {
          metadata[k] = v;
        }
      });
      const seqRaw = r["Volgnr"] || metadata["Volgnr"] || "";
      const seq = parseInt(String(seqRaw).replace(/^0+/, ""), 10) || 0;
      return {
        date,
        details: description,
        counterparty,
        amount,
        currency,
        type,
        metadata,
        seq,
      };
    });
    rows.sort((a, b) => a.seq - b.seq);
    setTotal(rows.length);
    setProcessed(0);
    setInsertedCount(0);
    setUpdatedCount(0);
    let imported = 0;
    let insertedRows = 0;
    let updated = 0;
    const importedIds: string[] = [];

    for (const tx of rows) {
      setMessage(
        `Verwerken ${imported + 1} / ${rows.length}... (${insertedRows} nieuw, ${updated} bijgewerkt)`,
      );
      const { data: existing, error: selErr } = await supabase
        .from("transactions")
        .select("id")
        .eq("date", tx.date)
        .eq("details", tx.details)
        .eq("amount", tx.amount)
        .limit(1);
      if (selErr) throw selErr;
      const payload: any = {
        date: tx.date,
        details: tx.details,
        counterparty: tx.counterparty,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        metadata: tx.metadata || {},
      };
      if (existing?.length) {
        const { error: updErr } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", existing[0].id);
        if (updErr) throw updErr;
        importedIds.push(existing[0].id);
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
    setPendingCsv(null);
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
        Upload a Rabobank CSV export to sync your transactions.
      </Text>

      {/* Upload card */}
      <TouchableOpacity
        style={[styles.uploadCard, pendingCsv && styles.uploadCardReady]}
        onPress={loading ? undefined : pickFile}
        activeOpacity={0.75}
      >
        <View style={styles.uploadIconWrap}>
          <Text style={{ fontSize: 28, color: FinColors.green }}>↑</Text>
        </View>
        <Text style={styles.uploadLabel}>Upload Rabobank CSV</Text>
        <Text style={styles.uploadHint}>
          {pendingCsv
            ? "File selected — review below"
            : "Tap to select a .csv file"}
        </Text>
        <View style={styles.uploadBtn}>
          <Text style={styles.uploadBtnText}>
            {pendingCsv ? "Change file" : "Select CSV file"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Preview table */}
      {preview.length > 0 && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Preview</Text>
          {pendingRowCount != null ? (
            <Text style={styles.previewSummary}>
              {pendingRowCount} rijen gevonden in CSV
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
      {pendingCsv && !loading && (
        <TouchableOpacity style={styles.importBtn} onPress={doImport}>
          <Text style={styles.importBtnText}>Import Transactions</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  content: { padding: 20, paddingTop: 8, gap: 16 },
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

  uploadCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: FinColors.borderSubtle,
    borderStyle: "dashed",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  uploadCardReady: {
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  uploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FinColors.greenBg,
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
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 12,
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
    borderRadius: 16,
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
  previewRowAlt: { backgroundColor: "rgba(148,163,184,0.04)", borderRadius: 6 },
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

  progressCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressText: { fontSize: 12, color: FinColors.textSecondary, flex: 1 },
  progressBarBg: {
    height: 4,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 4,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: FinColors.green,
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 11,
    color: FinColors.green,
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
    backgroundColor: FinColors.greenBg,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
  },
  successIcon: { fontSize: 20, color: FinColors.green },
  successText: {
    fontSize: 14,
    fontWeight: "600",
    color: FinColors.green,
    flex: 1,
  },

  errorCard: {
    backgroundColor: FinColors.redBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  errorText: { fontSize: 13, color: FinColors.red },

  importBtn: {
    backgroundColor: FinColors.textPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  importBtnText: { fontSize: 15, fontWeight: "700", color: FinColors.bgBase },
});
