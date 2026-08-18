import {
  type FieldSchemaV1,
  type FieldValueV1,
  formatMaterialSize,
  type MaterialMetadataV1,
  type SizeUnit,
} from "@certtrace/types";
import { LibraryError } from "./errors.js";

const SHAPE_FIELD_KEY = "shape";

export function getShapeField(schema: FieldSchemaV1) {
  return schema.fields.find((field) => field.key === SHAPE_FIELD_KEY);
}

export function getShapeOption(schema: FieldSchemaV1, shapeOptionId: string | undefined) {
  if (!shapeOptionId) {
    return undefined;
  }
  const shapeField = getShapeField(schema);
  return shapeField?.options?.find((option) => option.id === shapeOptionId);
}

export function getShapeDimensionKeys(schema: FieldSchemaV1, shapeOptionId: string | undefined) {
  return getShapeOption(schema, shapeOptionId)?.dimensionKeys ?? [];
}

export function getShapeSizePattern(schema: FieldSchemaV1, shapeOptionId: string | undefined) {
  return getShapeOption(schema, shapeOptionId)?.sizePattern;
}

export function isDimensionFieldKey(schema: FieldSchemaV1, key: string): boolean {
  const field = schema.fields.find((entry) => entry.key === key);
  return field?.type === "number" && getAllDimensionKeys(schema).has(key);
}

function getAllDimensionKeys(schema: FieldSchemaV1): Set<string> {
  const keys = new Set<string>();
  const shapeField = getShapeField(schema);
  for (const option of shapeField?.options ?? []) {
    for (const key of option.dimensionKeys ?? []) {
      keys.add(key);
    }
  }
  for (const field of schema.fields) {
    if (field.type === "number" && !keys.has(field.key)) {
      const usedOnShape = shapeField?.options?.some((option) =>
        option.dimensionKeys?.includes(field.key),
      );
      if (usedOnShape) {
        keys.add(field.key);
      }
    }
  }
  return keys;
}

export function collectDimensionValues(
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

export { formatMaterialSize } from "@certtrace/types";

export interface SanitizeMaterialSizeInput {
  fields: Record<string, FieldValueV1>;
  sizeUnit?: SizeUnit;
}

export interface SanitizeMaterialSizeResult {
  fields: Record<string, FieldValueV1>;
  sizeUnit?: SizeUnit;
}

/**
 * Strip dimension values not on the current Shape option; validate unit rules.
 * Call after merging field updates.
 */
export function sanitizeMaterialSize(
  schema: FieldSchemaV1,
  input: SanitizeMaterialSizeInput,
): SanitizeMaterialSizeResult {
  const fields = { ...input.fields };
  const shapeId = typeof fields.shape === "string" ? fields.shape : undefined;
  const allowedKeys = new Set(getShapeDimensionKeys(schema, shapeId));
  const allDimensionKeys = getAllDimensionKeys(schema);

  for (const key of allDimensionKeys) {
    if (!allowedKeys.has(key)) {
      delete fields[key];
    }
  }

  if (!shapeId) {
    for (const key of allDimensionKeys) {
      delete fields[key];
    }
    return { fields, sizeUnit: undefined };
  }

  const dimensionValues = collectDimensionValues(fields, [...allowedKeys]);
  const hasAnyDimension = Object.keys(dimensionValues).length > 0;

  if (!hasAnyDimension) {
    return { fields, sizeUnit: undefined };
  }

  if (!input.sizeUnit) {
    throw new LibraryError("Size requires a unit when any dimension is filled.");
  }

  return { fields, sizeUnit: input.sizeUnit };
}

export function clearShapeAndSize(
  schema: FieldSchemaV1,
  fields: Record<string, FieldValueV1>,
): Record<string, FieldValueV1> {
  const next = { ...fields };
  delete next.shape;
  for (const key of getAllDimensionKeys(schema)) {
    delete next[key];
  }
  return next;
}

export function clearShapeDimensions(
  schema: FieldSchemaV1,
  fields: Record<string, FieldValueV1>,
): Record<string, FieldValueV1> {
  const next = { ...fields };
  for (const key of getAllDimensionKeys(schema)) {
    delete next[key];
  }
  return next;
}

export function hasFilledShapeDimensions(
  schema: FieldSchemaV1,
  fields: Record<string, FieldValueV1>,
): boolean {
  const shapeId = typeof fields.shape === "string" ? fields.shape : undefined;
  const keys = getShapeDimensionKeys(schema, shapeId);
  return Object.keys(collectDimensionValues(fields, keys)).length > 0;
}

/** Millimetres per inch for Size column sort. */
const MM_PER_INCH = 25.4;

export function dimensionValueInMillimetres(value: number, unit: SizeUnit): number {
  return unit === "mm" ? value : value * MM_PER_INCH;
}

/**
 * Numeric sort key for a Material's Size: compare dimensions in Shape key order (mm).
 * Returns undefined when Size is empty (sorts last).
 */
export function materialSizeSortKey(
  schema: FieldSchemaV1,
  material: Pick<MaterialMetadataV1, "fields" | "sizeUnit">,
): number[] | undefined {
  const shapeId = typeof material.fields.shape === "string" ? material.fields.shape : undefined;
  const dimensionKeys = getShapeDimensionKeys(schema, shapeId);
  if (!shapeId || !material.sizeUnit || dimensionKeys.length === 0) {
    return undefined;
  }

  const values = collectDimensionValues(material.fields, dimensionKeys);
  if (Object.keys(values).length === 0) {
    return undefined;
  }

  return dimensionKeys.map((key) => {
    const value = values[key];
    if (value === undefined) {
      return Number.POSITIVE_INFINITY;
    }
    return dimensionValueInMillimetres(value, material.sizeUnit!);
  });
}

export function compareMaterialSize(
  schema: FieldSchemaV1,
  left: Pick<MaterialMetadataV1, "fields" | "sizeUnit">,
  right: Pick<MaterialMetadataV1, "fields" | "sizeUnit">,
): number {
  const leftKey = materialSizeSortKey(schema, left);
  const rightKey = materialSizeSortKey(schema, right);

  if (leftKey === undefined && rightKey === undefined) {
    return 0;
  }
  if (leftKey === undefined) {
    return 1;
  }
  if (rightKey === undefined) {
    return -1;
  }

  const length = Math.max(leftKey.length, rightKey.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftKey[index] ?? Number.POSITIVE_INFINITY;
    const rightValue = rightKey[index] ?? Number.POSITIVE_INFINITY;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }
  return 0;
}
