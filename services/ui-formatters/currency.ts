/**
 * UI formatting boundary for money labels in render trees.
 * PR-B adds the contract; follow-up PR will migrate screen-local formatters here.
 */

export type CurrencyFormatOptions = {
  locale?: string;
  currency?: string;
  maximumFractionDigits?: number;
};

export function formatCurrency(
  value: number | null | undefined,
  options: CurrencyFormatOptions = {},
): string {
  if (value == null || Number.isNaN(value)) return "Onbekend";
  const formatter = new Intl.NumberFormat(options.locale || "nl-NL", {
    style: "currency",
    currency: options.currency || "EUR",
    maximumFractionDigits: options.maximumFractionDigits,
  });
  return formatter.format(value);
}

export function formatSignedCurrency(
  value: number | null | undefined,
  options: CurrencyFormatOptions = {},
): string {
  if (value == null || Number.isNaN(value)) return "Onbekend";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(value), options)}`;
}
