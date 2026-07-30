import type { FieldSchemaV1, FieldValueV1 } from "@certtrace/types";

/** Display a field value as text using schema option labels when available. */
export function formatFieldValue(
  schema: FieldSchemaV1,
  key: string,
  value: FieldValueV1 | undefined,
): string {
  if (value === undefined) {
    return "";
  }

  const field = schema.fields.find((entry) => entry.key === key);
  const options = field?.options;

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((id) => options?.find((option) => option.id === id)?.label ?? id).join(", ");
  }

  if (options) {
    return options.find((option) => option.id === value)?.label ?? value;
  }

  return value;
}

/** Compact cue of present identifier values for the materials list. */
export function formatIdentifiersCue(
  schema: FieldSchemaV1,
  identifiers: Record<string, string>,
): string {
  return schema.identifierKinds
    .map((kind) => identifiers[kind.key]?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}
