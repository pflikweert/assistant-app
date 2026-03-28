/**
 * UI formatting boundary for date labels in screen render trees.
 * PR-B adds the contract; follow-up PR moves local render helpers here.
 */

export function formatDateLabel(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "nl-NL",
): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale, options);
}

export function formatDateRangeLabel(
  startIso: string,
  endIsoInclusive: string,
  locale = "nl-NL",
): string {
  const start = formatDateLabel(startIso, { day: "numeric", month: "short" }, locale);
  const end = formatDateLabel(endIsoInclusive, { day: "numeric", month: "short" }, locale);
  if (!start || !end) return "Onbekende periode";
  return `${start} - ${end}`;
}
