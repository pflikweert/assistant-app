export function normalizeTransactionDetails(value: string | null | undefined): string {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
}

