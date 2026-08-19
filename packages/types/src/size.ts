import { z } from "zod";
import type { FieldSchemaV1, FieldValueV1, MaterialMetadataV1 } from "./schemas/v1.js";

export const sizeUnitSchema = z.enum(["in", "mm"]);
export type SizeUnit = z.infer<typeof sizeUnitSchema>;

export const libraryDefaultUnitSchema = z.enum(["in", "mm", "app"]);
export type LibraryDefaultUnit = z.infer<typeof libraryDefaultUnitSchema>;

/** Shipped dimension field keys — permanent, shared across Shape options (ADR-0016). */
export const SHIPPED_DIMENSION_KEYS = [
  "thickness",
  "diameter",
  "width",
  "height",
  "od",
  "wall",
] as const;

export type ShippedDimensionKey = (typeof SHIPPED_DIMENSION_KEYS)[number];

export function isShippedDimensionKey(key: string): key is ShippedDimensionKey {
  return (SHIPPED_DIMENSION_KEYS as readonly string[]).includes(key);
}

export interface ShapeOptionPacking {
  dimensionKeys: string[];
  sizePattern: string;
}

/** Starter packing for known shipped Shape option ids (ADR-0015). */
export const SHIPPED_SHAPE_PACKING: Record<string, ShapeOptionPacking> = {
  plate: { dimensionKeys: ["thickness"], sizePattern: "{thickness} {unit}" },
  sheet: { dimensionKeys: ["thickness"], sizePattern: "{thickness} {unit}" },
  round_bar: { dimensionKeys: ["diameter"], sizePattern: "Ø {diameter} {unit}" },
  square_bar: { dimensionKeys: ["width"], sizePattern: "{width} x {width} {unit}" },
  rect_bar: { dimensionKeys: ["width", "height"], sizePattern: "{width} x {height} {unit}" },
  hex_bar: { dimensionKeys: ["width"], sizePattern: "{width} {unit}" },
  round_tube: { dimensionKeys: ["od", "wall"], sizePattern: "{od} x {wall} {unit}" },
  rect_tube: {
    dimensionKeys: ["width", "height", "wall"],
    sizePattern: "{width} x {height} x {wall} {unit}",
  },
};

export const SHIPPED_SHAPE_OPTION_IDS = Object.keys(SHIPPED_SHAPE_PACKING);

export function resolveSizeUnit(
  libraryDefaultUnit: LibraryDefaultUnit,
  installDefaultUnit: SizeUnit,
): SizeUnit {
  if (libraryDefaultUnit === "app") {
    return installDefaultUnit;
  }
  return libraryDefaultUnit;
}

export interface ParsedDimensionValue {
  value: number;
  /** Present when the user typed an explicit unit suffix. */
  unit?: SizeUnit;
}

/**
 * Parse a dimension input string. Bare numbers use `resolvedUnit`.
 * Accepts fractions (`1/2`, `1/2"`), decimals (`.125`), and suffixes (`12mm`, `0.5in`).
 */
export function parseDimensionValue(
  raw: string,
  _resolvedUnit: SizeUnit,
): ParsedDimensionValue | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)\s*(?:(mm|in|"))?\s*$/i);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator === 0) {
      return null;
    }
    const value = numerator / denominator;
    if (value <= 0) {
      return null;
    }
    const suffix = fractionMatch[3];
    const unit =
      suffix === undefined ? undefined : suffix.toLowerCase() === "mm" ? "mm" : ("in" as const);
    return { value, unit };
  }

  let numericPart = trimmed;
  let explicitUnit: SizeUnit | undefined;

  const suffixMatch = trimmed.match(/^(.*?)(?:\s*(mm|in|"))$/i);
  if (suffixMatch) {
    numericPart = suffixMatch[1]!.trim();
    explicitUnit = suffixMatch[2]!.toLowerCase() === "mm" ? "mm" : "in";
  }

  if (!numericPart) {
    return null;
  }

  const value = Number(numericPart);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return { value, unit: explicitUnit ?? (suffixMatch ? explicitUnit : undefined) };
}

/** Format a stored dimension: leading zero on decimals, no trailing zeros. */
export function formatDimensionValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  const formatted = value.toFixed(10).replace(/\.?0+$/, "");
  if (formatted.startsWith(".")) {
    return `0${formatted}`;
  }
  return formatted;
}

function formatUnitSuffix(unit: SizeUnit): string {
  return unit;
}

/**
 * Render a Size pattern for display (labels, list column, detail).
 * Empty dimensions are dropped; returns empty string when nothing is filled.
 */
export function renderSizePattern(
  pattern: string,
  dimensions: Record<string, number | undefined>,
  unit: SizeUnit | undefined,
): string {
  const filledKeys = new Set(
    Object.entries(dimensions)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key]) => key),
  );

  if (filledKeys.size === 0 || !unit) {
    return "";
  }

  let result = pattern;

  for (const [key, value] of Object.entries(dimensions)) {
    const token = `{${key}}`;
    if (value === undefined || value === null) {
      result = result.replaceAll(token, "");
    } else {
      result = result.replaceAll(token, formatDimensionValue(value));
    }
  }

  result = result.replaceAll("{unit}", formatUnitSuffix(unit));

  result = collapseSizePatternSeparators(result);

  if (result.includes("{")) {
    return "";
  }

  return result;
}

/** Remove `{key}` from a Size pattern and collapse leftover `x` / spaces. */
export function stripTokenFromSizePattern(pattern: string, key: string): string {
  let result = pattern.replaceAll(`{${key}}`, "");
  result = collapseSizePatternSeparators(result);
  const dimensionTokens = [...result.matchAll(/\{([^}]+)\}/g)]
    .map((match) => match[1])
    .filter((token) => token !== "unit");
  if (dimensionTokens.length === 0) {
    return "";
  }
  return result;
}

function collapseSizePatternSeparators(result: string): string {
  return result
    .replace(/\s+x\s+x\s+/gi, " x ")
    .replace(/^\s*x\s+/i, "")
    .replace(/\s+x\s*$/i, "")
    .replace(/\s+x\s+\{unit\}/gi, " {unit}")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+$/g, "")
    .replace(/^\s+/g, "")
    .trim();
}

const SHAPE_FIELD_KEY = "shape";

function collectDimensionValues(
  fields: Record<string, FieldValueV1>,
  dimensionKeys: string[],
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const key of dimensionKeys) {
    const raw = fields[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      values[key] = raw;
    }
  }
  return values;
}

/** Render the Size pattern string for a Material using the live field schema. */
export function formatMaterialSize(
  schema: FieldSchemaV1,
  material: Pick<MaterialMetadataV1, "fields" | "sizeUnit">,
): string {
  const shapeId = typeof material.fields.shape === "string" ? material.fields.shape : undefined;
  const shapeField = schema.fields.find((field) => field.key === SHAPE_FIELD_KEY);
  const shapeOption = shapeField?.options?.find((option) => option.id === shapeId);
  const pattern = shapeOption?.sizePattern;
  if (!pattern || !material.sizeUnit) {
    return "";
  }
  const dimensionKeys = shapeOption.dimensionKeys ?? [];
  const dimensions = collectDimensionValues(material.fields, dimensionKeys);
  return renderSizePattern(pattern, dimensions, material.sizeUnit);
}
