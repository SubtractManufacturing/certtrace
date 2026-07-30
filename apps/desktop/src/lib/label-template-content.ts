import {
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  type FieldSchemaV1,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
} from "@certtrace/types";

export interface LabelContentOption {
  key: string;
  label: string;
}

/** Built-in sample Material for Label Template WYSIWYG when no real Material is chosen. */
export function createSampleLabelMaterial(): MaterialMetadataV1 {
  return {
    version: SCHEMA_VERSION,
    id: "AL-falcon-104",
    fields: {
      family: "aluminum",
      alloy: "6061",
      temper: "t6511",
      shape: "round_bar",
      supplier: "mcmaster",
      storage_location: "Rack B2",
      traceability_type: "full_traceability",
    },
    identifiers: {
      heat_number: "A4921",
      lot_number: "L-7781",
      purchase_order: "PO-4412",
    },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
  };
}

/** Core slots always offered, then every Field and Identifier kind from the schema. */
export function labelContentOptions(fieldSchema: FieldSchemaV1): LabelContentOption[] {
  const core: LabelContentOption[] = [
    { key: LABEL_CONTENT_MATERIAL_ID, label: "Material id" },
    { key: LABEL_CONTENT_QR, label: "QR" },
    { key: LABEL_CONTENT_BARCODE, label: "Barcode" },
  ];

  const fields = fieldSchema.fields.map((field) => ({
    key: field.key,
    label: field.label,
  }));

  const identifiers = fieldSchema.identifierKinds.map((kind) => ({
    key: kind.key,
    label: kind.label,
  }));

  return [...core, ...fields, ...identifiers];
}

export function moveContentKey(
  contentKeys: string[],
  key: string,
  offset: -1 | 1,
): string[] | null {
  const index = contentKeys.indexOf(key);
  if (index < 0) {
    return null;
  }
  const target = index + offset;
  if (target < 0 || target >= contentKeys.length) {
    return null;
  }
  const next = [...contentKeys];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
