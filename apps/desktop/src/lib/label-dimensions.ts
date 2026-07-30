import type { LabelDisplayUnit } from "@certtrace/types";

const MM_PER_INCH = 25.4;

export function inchesToDisplay(inches: number, unit: LabelDisplayUnit): number {
  return unit === "mm" ? inches * MM_PER_INCH : inches;
}

export function displayToInches(value: number, unit: LabelDisplayUnit): number {
  return unit === "mm" ? value / MM_PER_INCH : value;
}

/** Format a stored-inch dimension for an input in the given display unit. */
export function formatDimensionInput(inches: number, unit: LabelDisplayUnit): string {
  const display = inchesToDisplay(inches, unit);
  // Trim floating noise (e.g. 100.0000001 mm) without forcing trailing zeros.
  const rounded = Math.round(display * 1e6) / 1e6;
  return String(rounded);
}

export interface ParsedDimensionInput {
  valueInches: number;
  displayUnit: LabelDisplayUnit;
}

/**
 * Parse a dimension field. Plain numbers stay in `currentUnit`.
 * Trailing `mm`, `in`, or `"` switches the template display unit and interprets
 * the numeric part in that unit.
 */
export function parseDimensionInput(
  raw: string,
  currentUnit: LabelDisplayUnit,
): ParsedDimensionInput | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const suffixMatch = trimmed.match(/^(.*?)(?:\s*(mm|in|"))$/i);
  let numericPart = trimmed;
  let unit = currentUnit;

  if (suffixMatch) {
    numericPart = suffixMatch[1]!.trim();
    const suffix = suffixMatch[2]!.toLowerCase();
    unit = suffix === "mm" ? "mm" : "in";
  }

  if (!numericPart) {
    return null;
  }

  const value = Number(numericPart);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    valueInches: displayToInches(value, unit),
    displayUnit: unit,
  };
}
