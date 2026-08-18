import {
  createLabelContentItem,
  type FieldSchemaV1,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  LABEL_CONTENT_SIZE,
  type LabelTemplate,
  type LibraryConfigV1,
  type NamingRulesV1,
  SCHEMA_VERSION,
  type WordListsV1,
} from "../schemas/v1.js";
import { SHIPPED_DIMENSION_KEYS, SHIPPED_SHAPE_PACKING } from "../size.js";

const DIMENSION_FIELD_LABELS: Record<(typeof SHIPPED_DIMENSION_KEYS)[number], string> = {
  thickness: "Thickness",
  diameter: "Diameter",
  width: "Width",
  height: "Height",
  od: "OD",
  wall: "Wall",
};
export const STARTER_LABEL_TEMPLATE_4X6_ID = "starter-4x6" as const;
export const STARTER_LABEL_TEMPLATE_LETTER_ID = "starter-letter" as const;
export const STARTER_LABEL_TEMPLATE_3X1_ID = "starter-3x1" as const;

const STARTER_LABEL_CONTENT_KEYS = [
  "family",
  "alloy",
  "temper",
  LABEL_CONTENT_SIZE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
] as const;

/** Compact field set for short/wide labels (no QR — packing prefers text density). */
const STARTER_3X1_CONTENT_KEYS = [LABEL_CONTENT_MATERIAL_ID, "family", "alloy", "temper"] as const;

export function createStarterLabelTemplates(): LabelTemplate[] {
  const content = STARTER_LABEL_CONTENT_KEYS.map((key) => createLabelContentItem(key));
  return [
    {
      id: STARTER_LABEL_TEMPLATE_4X6_ID,
      name: "4×6 in",
      size: { kind: "catalog", catalogId: "4x6" },
      displayUnit: "in",
      content: content.map((item) => ({ ...item })),
    },
    {
      id: STARTER_LABEL_TEMPLATE_LETTER_ID,
      name: "8.5×11 in",
      size: { kind: "catalog", catalogId: "letter" },
      displayUnit: "in",
      content: content.map((item) => ({ ...item })),
    },
    {
      id: STARTER_LABEL_TEMPLATE_3X1_ID,
      name: "3×1 in",
      size: { kind: "catalog", catalogId: "3x1" },
      displayUnit: "in",
      content: STARTER_3X1_CONTENT_KEYS.map((key) => createLabelContentItem(key)),
    },
  ];
}

export const defaultWordListsV1: WordListsV1 = {
  version: SCHEMA_VERSION,
  lists: {
    animals: {
      label: "Animals",
      words: ["falcon", "river", "hammer", "oak"],
    },
    adjectives: {
      label: "Adjectives",
      words: ["blue", "swift", "prime"],
    },
    colors: {
      label: "Colors",
      words: ["red", "slate", "amber"],
    },
    cities: {
      label: "Cities",
      words: ["denver", "toledo", "austin"],
    },
  },
};

export const defaultNamingRulesV1: NamingRulesV1 = {
  version: SCHEMA_VERSION,
  activeStrategyId: "material-animal-number",
  strategies: [
    {
      id: "numeric",
      label: "Numeric only",
      template: "{number}",
      numberStart: 10001,
      numberPad: 0,
    },
    {
      id: "prefix-numeric",
      label: "Prefix + numeric",
      template: "{material}-{number}",
      numberPad: 0,
    },
    {
      id: "date-based",
      label: "Date-based",
      template: "{material}-{year}{month}{day}-{number}",
      numberPad: 3,
    },
    {
      id: "word-pair",
      label: "Word pair",
      template: "{word:adjectives}-{word:animals}",
      case: "lower",
    },
    {
      id: "three-word",
      label: "Three word",
      template: "{word:adjectives}.{word:animals}.{word:cities}",
      case: "lower",
    },
    {
      id: "animal-number",
      label: "Animal + number",
      template: "{word:animals}-{number}",
      numberPad: 3,
      case: "lower",
    },
    {
      id: "material-animal-number",
      label: "Material + animal + number",
      template: "{material}-{word:animals}-{number}",
      numberPad: 3,
      case: "lower",
    },
  ],
};

export function createDefaultLibraryConfigV1(name: string): LibraryConfigV1 {
  const labelTemplates = createStarterLabelTemplates();
  return {
    version: SCHEMA_VERSION,
    name,
    idStrategy: defaultNamingRulesV1.activeStrategyId,
    labelTemplates,
    defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
    searchAllFields: false,
    defaultUnit: "app",
  };
}

/** Product default field schema, identifier kinds, attachment kinds, and starter options. */
export const defaultFieldSchemaV1: FieldSchemaV1 = {
  version: SCHEMA_VERSION,
  tableColumns: [
    { kind: "id" },
    { kind: "field", key: "family" },
    { kind: "field", key: "alloy" },
    { kind: "field", key: "temper" },
    { kind: "field", key: "supplier" },
    { kind: "field", key: "storage_location" },
    { kind: "attachments" },
    { kind: "identifiers" },
  ],
  fields: [
    {
      key: "family",
      label: "Material",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "aluminum", label: "Aluminum", shortCode: "AL" },
        { id: "steel", label: "Steel", shortCode: "ST" },
        { id: "stainless", label: "Stainless", shortCode: "SS" },
        { id: "brass", label: "Brass", shortCode: "BR" },
        { id: "plastic", label: "Plastic", shortCode: "PL" },
      ],
    },
    {
      key: "alloy",
      label: "Alloy",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "6061", label: "6061" },
        { id: "7075", label: "7075" },
        { id: "2024", label: "2024" },
        { id: "1018", label: "1018" },
        { id: "4140", label: "4140" },
        { id: "304", label: "304" },
        { id: "316", label: "316" },
        { id: "360", label: "360" },
        { id: "ultem", label: "Ultem" },
        { id: "delrin", label: "Delrin" },
      ],
      dependsOn: {
        fieldKey: "family",
        filterOptionsBy: {
          aluminum: ["6061", "7075", "2024"],
          steel: ["1018", "4140"],
          stainless: ["304", "316"],
          brass: ["360"],
          plastic: ["ultem", "delrin"],
        },
      },
    },
    {
      key: "temper",
      label: "Temper",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "t6", label: "T6" },
        { id: "t6511", label: "T6511" },
        { id: "o", label: "O" },
        { id: "annealed", label: "Annealed" },
        { id: "normalized", label: "Normalized" },
        { id: "hardened", label: "Hardened" },
        { id: "h900", label: "H900" },
      ],
      dependsOn: {
        fieldKey: "family",
        filterOptionsBy: {
          aluminum: ["t6", "t6511", "o"],
          steel: ["annealed", "normalized", "hardened"],
          stainless: ["annealed", "h900"],
          brass: ["o"],
          plastic: [],
        },
      },
    },
    {
      key: "shape",
      label: "Shape",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "plate", label: "Plate", ...SHIPPED_SHAPE_PACKING.plate },
        { id: "sheet", label: "Sheet", ...SHIPPED_SHAPE_PACKING.sheet },
        { id: "round_bar", label: "Round bar", ...SHIPPED_SHAPE_PACKING.round_bar },
        { id: "square_bar", label: "Square bar", ...SHIPPED_SHAPE_PACKING.square_bar },
        { id: "rect_bar", label: "Rectangle bar", ...SHIPPED_SHAPE_PACKING.rect_bar },
        { id: "hex_bar", label: "Hexagonal bar", ...SHIPPED_SHAPE_PACKING.hex_bar },
        { id: "round_tube", label: "Round tube", ...SHIPPED_SHAPE_PACKING.round_tube },
        { id: "rect_tube", label: "Rectangular tube", ...SHIPPED_SHAPE_PACKING.rect_tube },
      ],
    },
    ...SHIPPED_DIMENSION_KEYS.map((key) => ({
      key,
      label: DIMENSION_FIELD_LABELS[key],
      type: "number" as const,
      required: false,
      filterable: false,
    })),
    {
      key: "supplier",
      label: "Supplier",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "mcmaster", label: "McMaster" },
        { id: "boedecker", label: "Boedecker" },
        { id: "online_metals", label: "Online Metals" },
        { id: "speedy_metals", label: "Speedy Metals" },
      ],
    },
    {
      key: "traceability_type",
      label: "Traceability Type",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "material_cert", label: "Material cert" },
        { id: "coc", label: "COC" },
        { id: "full_traceability", label: "Full Traceability" },
      ],
    },
    {
      key: "date_received",
      label: "Date Received",
      type: "date",
      required: false,
      filterable: true,
    },
    {
      key: "storage_location",
      label: "Storage Location",
      type: "text",
      required: false,
      filterable: true,
    },
    {
      key: "notes",
      label: "Notes",
      type: "long_text",
      required: false,
      filterable: false,
    },
  ],
  identifierKinds: [
    { key: "heat_number", label: "Heat Number", required: false, filterable: true },
    { key: "lot_number", label: "Lot Number", required: false, filterable: true },
    { key: "purchase_order", label: "Purchase Order", required: false, filterable: true },
  ],
  attachmentKinds: [
    { key: "mtr", label: "MTR" },
    { key: "heat_cert", label: "Heat cert" },
    { key: "coc", label: "COC" },
    { key: "other", label: "Other" },
  ],
};
