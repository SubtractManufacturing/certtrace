import type { FieldSchemaV1 } from "@certtrace/types";

export type MaterialColumnKind = "id" | "field" | "identifiers" | "attachments" | "library";

export interface MaterialColumn {
  kind: MaterialColumnKind;
  key: string;
  label: string;
}

/** Shipped default list columns for the new field model (PRD #77 / issue #79). */
const DEFAULT_FIELD_KEYS = ["family", "alloy", "temper", "supplier", "storage_location"] as const;

export function defaultMaterialColumns(schema: FieldSchemaV1): MaterialColumn[] {
  const fieldByKey = new Map(schema.fields.map((field) => [field.key, field]));
  const columns: MaterialColumn[] = [{ kind: "id", key: "id", label: "ID" }];

  for (const key of DEFAULT_FIELD_KEYS) {
    const field = fieldByKey.get(key);
    if (field) {
      columns.push({ kind: "field", key: field.key, label: field.label });
    }
  }

  columns.push({ kind: "attachments", key: "attachments", label: "Attachments" });

  if (schema.identifierKinds.length > 0) {
    columns.push({ kind: "identifiers", key: "identifiers", label: "Identifiers" });
  }

  return columns;
}
