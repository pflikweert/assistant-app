import { ThemedText } from "@/components/themed-text";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Button, Platform, View } from "react-native";
// papaparse doesn't currently ship typings
// @ts-ignore
import { supabase } from "@/services/supabase";
import Papa from "papaparse";

export default function CSVImportScreen() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const [currentDescription, setCurrentDescription] = useState<string | null>(
    null,
  );
  // navigation guard / header control
  const navigation = useNavigation();

  React.useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (loading) {
        e.preventDefault();
        Alert.alert("Importing", "The import is still running, please wait");
      }
    });
    return unsub;
  }, [navigation, loading]);

  const pickFile = async () => {
    if (Platform.OS === "web") {
      // web browsers can use a hidden file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv";
      input.onchange = async (e: any) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          // start import immediately and reset any previous progress
          setLoading(true);
          setTotal(null);
          setProcessed(0);
          setMessage("Importing...");
          // allow render of loader before heavy work
          await Promise.resolve();
          try {
            const text = await file.text();
            await handleCsvContent(text);
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            console.error("web import error", err);
            setMessage(`Import failed: ${errMsg}`);
            Alert.alert("Error", errMsg);
          } finally {
            setLoading(false);
          }
        }
      };
      input.click();
      return;
    }

    try {
      const res: any = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      console.log("DocumentPicker result", res);
      // Expo sometimes returns { type: 'cancel' } when user exits picker
      if (res.type === "cancel") {
        setMessage("Picker cancelled");
        return;
      }
      if (res && res.uri) {
        // hide picked-file message; indicate loading
        setLoading(true);
        setMessage("Importing...");
        await Promise.resolve();
        await handleFile(res.uri);
      } else {
        const info = JSON.stringify(res);
        setMessage("No file selected (no uri returned)");
        Alert.alert("Picker result", info);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleFile = async (uri: string) => {
    console.log("handleFile called with", uri);
    setLoading(true);
    // reset counters in case previous attempt left them set
    setTotal(null);
    setProcessed(0);
    setMessage("Importing...");

    try {
      // reading without explicit encoding is fine (defaults to utf8)
      const csv = await FileSystem.readAsStringAsync(uri);
      console.log("read csv length", csv.length);
      await handleCsvContent(csv);
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      console.error("import error", e);
      setMessage(`Import failed: ${errMsg}`);
      Alert.alert("Error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  async function handleCsvContent(csv: string) {
    const { data, errors } = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      // tolerate uneven quotes by treating errors above
      dynamicTyping: false,
    });
    if (errors.length) {
      // log parse errors but don't abort; users will be notified after import
      console.warn("CSV parse errors", errors);
      Alert.alert(
        "Parsing issues",
        errors.map((e: any) => e.message).join("\n"),
      );
    }

    type Row = Record<string, string>;
    const rows = (data as Row[]).map((r) => {
      // generic mapping from Rabobank export; fallbacks are generic
      const date = r["Datum"] || r.Date;
      const amountRaw = r["Bedrag"] || r.Amount || "0";
      const amount = parseFloat(amountRaw.replace(",", ".")) || 0;
      const currency = r["Munt"] || r.Currency;
      // build a description combining available columns
      const descriptionParts: string[] = [];
      if (r["Omschrijving-1"]) descriptionParts.push(r["Omschrijving-1"]);
      if (r["Omschrijving-2"]) descriptionParts.push(r["Omschrijving-2"]);
      if (r["Omschrijving-3"]) descriptionParts.push(r["Omschrijving-3"]);
      if (r["Naam tegenpartij"]) descriptionParts.push(r["Naam tegenpartij"]);
      if (r["Naam / Omschrijving"])
        descriptionParts.push(r["Naam / Omschrijving"]);
      const description = descriptionParts.filter(Boolean).join(" | ");
      const counterparty =
        r["Naam tegenpartij"] ||
        r["Naam uiteindelijke partij"] ||
        r["Tegenrekening IBAN/BBAN"];
      const type = r["Code"] || r["Type"];

      // metadata contains all original fields not specifically mapped
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

      // attempt to parse volgnummer from original columns or metadata
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
    // sort by sequence ascending before inserting
    rows.sort((a, b) => a.seq - b.seq);

    // immediately show progress container even while parsing
    setTotal(rows.length);
    setProcessed(0);
    let imported = 0;

    for (const tx of rows) {
      setCurrentDescription(tx.details || "");

      // update the status message so the user sees activity
      setMessage(`Importing ${imported}/${rows.length}...`);

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

      if (existing && existing.length) {
        const { error: updErr } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", existing[0].id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("transactions")
          .insert(payload);
        if (insErr) throw insErr;
      }
      imported += 1;
      setProcessed(imported);
    }

    const successMsg = `Imported ${imported} transaction${imported === 1 ? "" : "s"}.`;
    setMessage(successMsg);
    setCurrentDescription(null);
    // show a modal success message as well
    Alert.alert("Success", successMsg);
  }

  React.useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (loading) {
        // prevent leaving while import is active
        e.preventDefault();
        Alert.alert("Importing", "The import is still running, please wait");
      }
    });
    return unsub;
  }, [navigation, loading]);

  React.useLayoutEffect(() => {
    // hide the header back button when import is running
    navigation.setOptions({
      headerLeft: loading ? () => null : undefined,
    });
  }, [navigation, loading]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {!loading && <Button title="Select CSV" onPress={pickFile} />}
      {loading && (
        <View style={{ marginTop: 20 }}>
          <ActivityIndicator />
          {total != null && (
            <ThemedText style={{ marginTop: 8 }}>
              ({processed}/{total}) {currentDescription || ""}
            </ThemedText>
          )}
        </View>
      )}
      {message ? (
        <ThemedText style={{ marginTop: 20 }}>{message}</ThemedText>
      ) : null}
    </View>
  );
}
