import {
  type FieldSchemaV1,
  type MaterialTableColumnV1,
  materialTableColumnIdentity,
} from "@certtrace/types";

export type MaterialColumnKind =
  | "id"
  | "field"
  | "identifier"
  | "identifiers"
  | "attachments"
  | "library";

export interface MaterialColumn {
  kind: MaterialColumnKind;
  key: string;
  label: string;
}

/** Shipped default list columns for the new field model (PRD #77 / issue #79). */
const DEFAULT_FIELD_KEYS = ["family", "alloy", "temper", "supplier", "storage_location"] as const;

export function defaultMaterialColumns(schema: FieldSchemaV1): MaterialColumn[] {
  return resolveMaterialColumns(schema, [
    { kind: "id" },
    ...DEFAULT_FIELD_KEYS.map((key) => ({ kind: "field" as const, key })),
    { kind: "attachments" },
    { kind: "identifiers" },
  ]);
}

export function materialColumns(schema: FieldSchemaV1): MaterialColumn[] {
  return schema.tableColumns
    ? resolveMaterialColumns(schema, schema.tableColumns)
    : defaultMaterialColumns(schema);
}

export interface MaterialColumnOption {
  column: MaterialTableColumnV1;
  label: string;
}

export function materialColumnOptions(schema: FieldSchemaV1): MaterialColumnOption[] {
  return [
    { column: { kind: "id" }, label: "ID" },
    ...schema.fields.map((field) => ({
      column: { kind: "field" as const, key: field.key },
      label: field.label,
    })),
    ...schema.identifierKinds.map((kind) => ({
      column: { kind: "identifier" as const, key: kind.key },
      label: kind.label,
    })),
    { column: { kind: "attachments" }, label: "Attachment count" },
    { column: { kind: "identifiers" }, label: "Identifiers (compact)" },
  ];
}

export function resolvedMaterialColumnIdentity(column: MaterialColumn): string {
  return column.kind === "field" || column.kind === "identifier"
    ? materialTableColumnIdentity({ kind: column.kind, key: column.key })
    : column.kind;
}

function resolveMaterialColumns(
  schema: FieldSchemaV1,
  selected: MaterialTableColumnV1[],
): MaterialColumn[] {
  const fieldByKey = new Map(schema.fields.map((field) => [field.key, field]));
  const identifierByKey = new Map(schema.identifierKinds.map((kind) => [kind.key, kind]));
  const columns: MaterialColumn[] = [];

  for (const column of selected) {
    switch (column.kind) {
      case "id":
        columns.push({ kind: "id", key: "id", label: "ID" });
        break;
      case "field": {
        const field = fieldByKey.get(column.key);
        if (field) {
          columns.push({ kind: "field", key: field.key, label: field.label });
        }
        break;
      }
      case "identifier": {
        const kind = identifierByKey.get(column.key);
        if (kind) {
          columns.push({ kind: "identifier", key: kind.key, label: kind.label });
        }
        break;
      }
      case "attachments":
        columns.push({ kind: "attachments", key: "attachments", label: "Attachments" });
        break;
      case "identifiers":
        if (schema.identifierKinds.length > 0) {
          columns.push({ kind: "identifiers", key: "identifiers", label: "Identifiers" });
        }
        break;
    }
  }

  return columns;
}
