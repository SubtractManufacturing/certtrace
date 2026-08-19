import {
  createLabelContentItem,
  type FieldSchemaV1,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  LABEL_CONTENT_SIZE,
  type LabelContentItem,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
} from "@certtrace/types";

export interface LabelContentOption {
  key: string;
  label: string;
}

export type LabelContentListRow =
  | { kind: "enabled"; item: LabelContentItem; option: LabelContentOption }
  | { kind: "disabled"; option: LabelContentOption };

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
      diameter: 1.25,
      supplier: "mcmaster",
      storage_location: "Rack B2",
      traceability_type: "full_traceability",
    },
    sizeUnit: "in",
    identifiers: {
      heat_number: "A4921",
      lot_number: "L-7781",
      purchase_order: "PO-4412",
    },
    archived: false,
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
  };
}

/** Core slots always offered, then Fields and Identifier kinds from the schema. */
export function labelContentOptions(fieldSchema: FieldSchemaV1): LabelContentOption[] {
  const core: LabelContentOption[] = [
    { key: LABEL_CONTENT_SIZE, label: "Size" },
    { key: LABEL_CONTENT_MATERIAL_ID, label: "Material id" },
    { key: LABEL_CONTENT_QR, label: "QR" },
    { key: LABEL_CONTENT_BARCODE, label: "Barcode" },
  ];

  const coreKeys = new Set(core.map((option) => option.key));

  const fields = fieldSchema.fields
    .filter((field) => !coreKeys.has(field.key))
    .map((field) => ({
      key: field.key,
      label: field.label,
    }));

  const identifiers = fieldSchema.identifierKinds
    .filter((kind) => !coreKeys.has(kind.key))
    .map((kind) => ({
      key: kind.key,
      label: kind.label,
    }));

  return [...core, ...fields, ...identifiers];
}

/** Enabled rows in template order, then disabled options in catalog order. */
export function labelContentListRows(
  options: LabelContentOption[],
  content: LabelContentItem[],
): LabelContentListRow[] {
  const optionByKey = new Map(options.map((option) => [option.key, option]));
  const enabledKeys = new Set(content.map((item) => item.key));

  const enabled: LabelContentListRow[] = content.map((item) => ({
    kind: "enabled",
    item,
    option: optionByKey.get(item.key) ?? { key: item.key, label: item.key },
  }));

  const disabled: LabelContentListRow[] = options
    .filter((option) => !enabledKeys.has(option.key))
    .map((option) => ({ kind: "disabled", option }));

  return [...enabled, ...disabled];
}

export function reorderContentItems(
  content: LabelContentItem[],
  fromKey: string,
  toKey: string,
): LabelContentItem[] {
  const from = content.findIndex((item) => item.key === fromKey);
  const to = content.findIndex((item) => item.key === toKey);
  if (from < 0 || to < 0 || from === to) {
    return content;
  }
  const next = [...content];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function enableContentItem(content: LabelContentItem[], key: string): LabelContentItem[] {
  if (content.some((item) => item.key === key)) {
    return content;
  }
  return [...content, createLabelContentItem(key)];
}

export function disableContentItem(
  content: LabelContentItem[],
  key: string,
): LabelContentItem[] | null {
  if (content.length <= 1) {
    return null;
  }
  return content.filter((item) => item.key !== key);
}

export function patchContentItem(
  content: LabelContentItem[],
  key: string,
  patch: Partial<Pick<LabelContentItem, "align" | "size">>,
): LabelContentItem[] {
  return content.map((item) => (item.key === key ? { ...item, ...patch } : item));
}
