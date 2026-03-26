import type { ImportSource } from "./transaction-import-parser";

type ResolveImportSourceInput = {
  fileName?: string | null;
  mimeType?: string | null;
  textContent?: string | null;
  base64Content?: string | null;
};

function normalizeValue(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function looksLikePdfBase64(content: string): boolean {
  const normalized = content.replace(/\s+/g, "");
  return normalized.startsWith("JVBERi0") || normalized.startsWith("JVBER");
}

function looksLikePdfText(content: string): boolean {
  return content.trimStart().startsWith("%PDF");
}

function looksLikeCsvText(content: string): boolean {
  const firstLine = content.split(/\r?\n/)[0] || "";
  return /[,;]\s*/.test(firstLine) || /^Datum[;,]/i.test(firstLine);
}

export function resolveImportSource({
  fileName,
  mimeType,
  textContent,
  base64Content,
}: ResolveImportSourceInput): ImportSource {
  const normalizedName = normalizeValue(fileName);
  const normalizedMimeType = normalizeValue(mimeType);

  if (
    normalizedName.endsWith(".pdf") ||
    normalizedMimeType.includes("pdf")
  ) {
    return "pdf";
  }

  if (
    normalizedName.endsWith(".csv") ||
    normalizedMimeType.includes("csv") ||
    normalizedMimeType.startsWith("text/")
  ) {
    return "csv";
  }

  if (base64Content && looksLikePdfBase64(base64Content)) {
    return "pdf";
  }

  if (textContent) {
    if (looksLikePdfBase64(textContent)) {
      return "pdf";
    }
    if (looksLikePdfText(textContent)) {
      return "pdf";
    }
    if (looksLikeCsvText(textContent)) {
      return "csv";
    }
  }

  return "csv";
}
