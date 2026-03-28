/**
 * UI formatting boundary for percentage labels in render trees.
 */

export function formatPercentage(
  value: number | null | undefined,
  digits = 0,
): string {
  if (value == null || Number.isNaN(value)) return "Onbekend";
  return `${value.toFixed(digits)}%`;
}

export function toRoundedPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}
