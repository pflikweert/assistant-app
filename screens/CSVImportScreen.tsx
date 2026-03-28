import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppIcon } from "@/components/ui/app-icon";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinancePrimaryCtaButton } from "@/components/ui/finance-primary-cta-button";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { IMPORT_FLOW_STEPS } from "@/components/import/import-flow-steps";
import {
  buildImportDraft,
  clearCurrentImportDraft,
  clearCurrentImportRunResult,
  setCurrentImportDraft,
} from "@/services/import/import-flow-state";
import {
  eventHasDraggedFiles,
  extractDroppedFile,
  isDropInsideUploadCard,
} from "@/services/import/import-web-drop";
import { resolveImportSource } from "@/services/import/import-source";
import { parseTransactionImport } from "@/services/import/transaction-import-parser";

type ImportStatus =
  | "idle"
  | "choosing"
  | "uploading"
  | "processing"
  | "error";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export default function CSVImportScreen() {
  const navigation = useNavigation();
  const router = useRouter();

  const [status, setStatus] = React.useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isChoosing, setIsChoosing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const uploadCardRef = React.useRef<React.ElementRef<typeof View> | null>(null);
  const isBusy = status === "choosing" || status === "uploading" || status === "processing";

  const getUploadCardElement = React.useCallback(() => {
    if (Platform.OS !== "web") return null;
    const fromRef = uploadCardRef.current as any;
    if (fromRef && typeof fromRef.getBoundingClientRect === "function") {
      return fromRef as {
        getBoundingClientRect: () => {
          left: number;
          right: number;
          top: number;
          bottom: number;
        };
      };
    }
    const maybeNode = findNodeHandle(uploadCardRef.current as any) as any;
    if (maybeNode && typeof maybeNode.getBoundingClientRect === "function") {
      return maybeNode as {
        getBoundingClientRect: () => {
          left: number;
          right: number;
          top: number;
          bottom: number;
        };
      };
    }
    return null;
  }, []);

  React.useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (event: any) => {
      if (isBusy || isChoosing) {
        event.preventDefault();
        Alert.alert(
          "Even wachten",
          "Budio verwerkt het bestand nog. Wacht heel even tot de samenvatting klaar is.",
        );
      }
    });
    return unsub;
  }, [isBusy, isChoosing, navigation]);

  const processFile = React.useCallback(
    async (input: {
      fileName: string | null;
      mimeType: string | null;
      textContent?: string | null;
      base64Content?: string | null;
    }) => {
      setStatus("processing");
      setErrorMessage(null);
      clearCurrentImportDraft();
      clearCurrentImportRunResult();

      try {
        const source = resolveImportSource(input);
        const content = source === "pdf" ? input.base64Content : input.textContent;
        if (!content) {
          throw new Error("We konden dit bestand niet uitlezen.");
        }

        const rows = parseTransactionImport(source, content);
        if (!rows.length) {
          throw new Error("We konden geen bruikbare transacties vinden.");
        }

        const draft = buildImportDraft(source, input.fileName, rows);
        setCurrentImportDraft(draft);
      } catch (error) {
        clearCurrentImportDraft();
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We konden dit bestand niet verwerken.",
        );
        return;
      }
      router.push("/accounts/link");
    },
    [router],
  );

  const processWebFile = React.useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setStatus("uploading");
      setIsChoosing(false);
      setIsDragging(false);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const textContent = new TextDecoder("utf-8").decode(bytes);
      const base64Content = toBase64(bytes);
      await processFile({
        fileName: file.name || null,
        mimeType: file.type || null,
        textContent,
        base64Content,
      });
    },
    [processFile],
  );

  React.useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleDragEnter = (event: any) => {
      if (!eventHasDraggedFiles(event)) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      if (isBusy) {
        setIsDragging(false);
        return;
      }
      setIsDragging(isDropInsideUploadCard(event, getUploadCardElement()));
    };

    const handleDragOver = (event: any) => {
      if (!eventHasDraggedFiles(event)) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      if (isBusy) {
        setIsDragging(false);
        return;
      }
      setIsDragging(isDropInsideUploadCard(event, getUploadCardElement()));
    };

    const handleDragLeave = (event: any) => {
      if (!eventHasDraggedFiles(event)) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      const isInside = isDropInsideUploadCard(event, getUploadCardElement());
      if (!isInside) {
        setIsDragging(false);
      }
    };

    const handleDrop = (event: any) => {
      event.preventDefault?.();
      event.stopPropagation?.();

      if (!eventHasDraggedFiles(event)) {
        setIsDragging(false);
        return;
      }

      const isInside = isDropInsideUploadCard(event, getUploadCardElement());
      setIsDragging(false);
      if (!isInside || isBusy) return;

      const file = extractDroppedFile(event);
      if (!file) {
        setStatus("error");
        setErrorMessage("We konden dit bestand niet inlezen.");
        return;
      }

      void processWebFile(file).catch((error) => {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We konden dit bestand niet verwerken.",
        );
      });
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      setIsDragging(false);
    };
  }, [getUploadCardElement, isBusy, processWebFile]);

  const pickFile = React.useCallback(async () => {
    if (isBusy) return;

    setIsChoosing(true);
    setErrorMessage(null);
    setStatus("choosing");
    setIsDragging(false);

    try {
      if (Platform.OS === "web") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,.pdf,application/pdf,text/csv";
        let settled = false;

        const finishAsCancel = () => {
          if (settled) return;
          settled = true;
          setIsChoosing(false);
          setStatus("idle");
        };

        const handleWindowFocus = () => {
          setTimeout(() => {
            if (!settled) {
              finishAsCancel();
            }
          }, 250);
          window.removeEventListener("focus", handleWindowFocus);
        };

        window.addEventListener("focus", handleWindowFocus);
        (input as any).oncancel = finishAsCancel;
        input.onchange = async (event: any) => {
          const file = event.target?.files?.[0];
          if (!file) {
            finishAsCancel();
            return;
          }
          settled = true;
          setIsChoosing(false);
          await processWebFile(file);
        };
        input.click();
        return;
      }

      const res: any = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", ".pdf", ".csv"],
      });

      if (res?.type === "cancel" || res?.canceled) {
        setIsChoosing(false);
        setStatus("idle");
        return;
      }

      const fileName = res?.name || null;
      const mimeType = res?.mimeType || null;
      setStatus("uploading");
      await processFile({
        fileName,
        mimeType,
        textContent: await FileSystem.readAsStringAsync(res.uri, {
          encoding: "utf8",
        }).catch(() => null),
        base64Content: await FileSystem.readAsStringAsync(res.uri, {
          encoding: "base64",
        }).catch(() => null),
      });
      setIsChoosing(false);
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We konden het bestand niet kiezen.",
      );
      setIsChoosing(false);
    }
  }, [isBusy, processFile, processWebFile]);

  const statusTitle =
    status === "choosing"
      ? "Bestand kiezen"
      : status === "uploading"
        ? "Bestand wordt ingelezen"
      : status === "processing"
        ? "Bestand wordt verwerkt"
      : status === "error"
        ? "Dit bestand lukt nog niet"
        : "Nog geen bestand gekozen";

  const statusText =
    status === "choosing"
      ? "De bestandskiezer staat open. Kies een bestand om door te gaan."
      : status === "uploading"
        ? "Je bestand is gekozen. Budio leest het nu in."
      : status === "processing"
        ? "Budio leest je bestand in en maakt de transacties klaar."
      : status === "error"
        ? errorMessage || "Kies een Rabobank-bestand als CSV of PDF."
        : "Kies een bestand van je bank. Daarna laten we zien welke rekeningen erin staan.";
  const showStatusCard =
    status === "choosing" || status === "uploading" || status === "processing";
  const showErrorCard = status === "error";

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDetailTopBar title="Importeren" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentMax}>
          <FinanceStepIndicator
            steps={IMPORT_FLOW_STEPS}
            currentStepKey="choose-file"
          />

          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Kies een bestand van je bank</Text>
            <Text style={styles.introText}>
              Budio herkent het bestand automatisch. Daarna controleer je eerst welke rekeningen erin staan.
            </Text>
          </View>

          {showErrorCard ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Dit bestand lukt nog niet</Text>
              <Text style={styles.errorText}>{statusText}</Text>
            </View>
          ) : null}

          <View
            ref={uploadCardRef}
            style={[
              styles.uploadCard,
              isBusy && styles.uploadCardProcessing,
              isDragging && styles.uploadCardDragActive,
            ]}
          >
            <View style={styles.uploadIconWrap}>
              {status === "uploading" || status === "processing" || isChoosing ? (
                <ActivityIndicator color={FinColors.warningText} />
              ) : (
                <AppIcon
                  name="upload-file"
                  size={30}
                  color={FinColors.warningText}
                  variant="outlined"
                />
              )}
            </View>
            <Text style={styles.uploadTitle}>Sleep je bestand hierheen</Text>
            <Text style={styles.uploadHint}>
              Gebruik een Rabobank-export als CSV of PDF.
            </Text>
            <FinancePrimaryCtaButton
              label={
                status === "choosing"
                  ? "Bestand kiezen..."
                  : status === "uploading"
                    ? "Bestand inlezen..."
                    : status === "processing"
                      ? "Bestand verwerken..."
                      : "Bestand kiezen"
              }
              onPress={pickFile}
              disabled={isBusy}
              style={styles.uploadButton}
            />
          </View>

          {showStatusCard ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          ) : null}

          <View style={styles.privacyRow}>
            <AppIcon name="lock" size={14} color={FinColors.textMuted} variant="outlined" />
            <Text style={styles.privacyText}>
              PRIVACY FIRST · JE DATA BLIJFT VERSLEUTELD
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 28,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 32,
    gap: 14,
  },
  introCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 20,
    gap: 8,
  },
  introTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  introText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  uploadCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: FinColors.borderSubtle,
    paddingVertical: 34,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 12,
  },
  uploadCardProcessing: {
    opacity: 0.96,
  },
  uploadCardDragActive: {
    borderColor: FinColors.warningText,
    backgroundColor: FinColors.warningBg,
  },
  uploadIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
  },
  uploadTitle: {
    fontSize: 19,
    lineHeight: 24,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  uploadHint: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
    textAlign: "center",
    maxWidth: 260,
  },
  uploadButton: {
    marginTop: 10,
    minWidth: 196,
  },
  statusCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  statusTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  errorCard: {
    backgroundColor: FinColors.redBg,
    borderRadius: 20,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(197,93,76,0.24)",
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.red,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.red,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 6,
  },
  privacyText: {
    fontSize: 11,
    lineHeight: 15,
    color: FinColors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
});
