import {
  formatDimensionValue,
  parseDimensionValue,
  type SizeUnit,
} from "@certtrace/types";

export function formatDimensionInput(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return formatDimensionValue(value);
}

export interface ParsedSizeDimension {
  value: number;
  unit?: SizeUnit;
}

export function parseSizeDimensionInput(
  raw: string,
  resolvedUnit: SizeUnit,
): ParsedSizeDimension | null {
  return parseDimensionValue(raw, resolvedUnit);
}
