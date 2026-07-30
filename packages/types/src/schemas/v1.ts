import { z } from "zod";

export const SCHEMA_VERSION = 3 as const;

/** Well-known Label Template content keys (not Field/Identifier keys). */
export const LABEL_CONTENT_MATERIAL_ID = "material_id" as const;
export const LABEL_CONTENT_QR = "qr" as const;
export const LABEL_CONTENT_BARCODE = "barcode" as const;

export const labelContentAlignSchema = z.enum(["left", "center", "right"]);
export type LabelContentAlign = z.infer<typeof labelContentAlignSchema>;

export const labelContentSizeSchema = z.enum(["small", "medium", "large"]);
export type LabelContentSize = z.infer<typeof labelContentSizeSchema>;

/** Relative layout weight for Small / Medium / Large content slots. */
export const LABEL_CONTENT_SIZE_WEIGHT: Record<LabelContentSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.25,
};

export const labelContentItemSchema = z.object({
  key: z.string().min(1),
  align: labelContentAlignSchema,
  size: labelContentSizeSchema,
});
export type LabelContentItem = z.infer<typeof labelContentItemSchema>;

export function createLabelContentItem(
  key: string,
  overrides?: Partial<Pick<LabelContentItem, "align" | "size">>,
): LabelContentItem {
  return {
    key,
    align: overrides?.align ?? "left",
    size: overrides?.size ?? "medium",
  };
}

export const labelDisplayUnitSchema = z.enum(["in", "mm"]);
export type LabelDisplayUnit = z.infer<typeof labelDisplayUnitSchema>;

/** Shipped label-size catalog ids. Starters use `4x6` and `letter`. */
export const labelSizeCatalogIdSchema = z.enum(["3x1", "4x6", "letter"]);
export type LabelSizeCatalogId = z.infer<typeof labelSizeCatalogIdSchema>;

/** Canonical size in inches for each catalog entry (PDF uses 72 pt/in). */
export const LABEL_SIZE_CATALOG: Record<LabelSizeCatalogId, { widthIn: number; heightIn: number }> =
  {
    "3x1": { widthIn: 3, heightIn: 1 },
    "4x6": { widthIn: 4, heightIn: 6 },
    letter: { widthIn: 8.5, heightIn: 11 },
  };

export const labelSizeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("catalog"),
    catalogId: labelSizeCatalogIdSchema,
  }),
  z.object({
    kind: z.literal("custom"),
    widthIn: z.number().positive(),
    heightIn: z.number().positive(),
  }),
]);
export type LabelSize = z.infer<typeof labelSizeSchema>;

export const labelTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  size: labelSizeSchema,
  displayUnit: labelDisplayUnitSchema,
  /**
   * Ordered enabled content slots: core keys (`material_id`, `qr`, `barcode`),
   * Field keys, or Identifier kind keys, each with align and relative size.
   */
  content: z.array(labelContentItemSchema).min(1),
});
export type LabelTemplate = z.infer<typeof labelTemplateSchema>;

export const libraryConfigV1Schema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    name: z.string().min(1),
    idStrategy: z.string().min(1),
    labelTemplates: z.array(labelTemplateSchema).min(1),
    defaultLabelTemplateId: z.string().min(1),
    /** Legacy compatibility only. Search is always material ID plus identifier values (ADR-0004). */
    searchAllFields: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.labelTemplates.map((template) => template.id));
    if (ids.size !== value.labelTemplates.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "labelTemplates ids must be unique",
        path: ["labelTemplates"],
      });
    }
    if (!ids.has(value.defaultLabelTemplateId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "defaultLabelTemplateId must match a label template id",
        path: ["defaultLabelTemplateId"],
      });
    }
  });

export type LibraryConfigV1 = z.infer<typeof libraryConfigV1Schema>;

export const namingCaseSchema = z.enum(["lower", "upper", "preserve"]);

export type NamingCase = z.infer<typeof namingCaseSchema>;

export const namingStrategyV1Schema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  template: z.string().min(1),
  numberPad: z.number().int().min(0).optional(),
  numberStart: z.number().int().optional(),
  case: namingCaseSchema.optional(),
});

export type NamingStrategyV1 = z.infer<typeof namingStrategyV1Schema>;

export const namingRulesV1Schema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    strategies: z.array(namingStrategyV1Schema).min(1),
    activeStrategyId: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.strategies.map((strategy) => strategy.id));
    if (!ids.has(value.activeStrategyId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "activeStrategyId must match a strategy id",
        path: ["activeStrategyId"],
      });
    }
  });

export type NamingRulesV1 = z.infer<typeof namingRulesV1Schema>;

export const wordListEntryV1Schema = z.object({
  label: z.string().min(1),
  words: z.array(z.string().min(1)).min(1),
});

export type WordListEntryV1 = z.infer<typeof wordListEntryV1Schema>;

export const wordListsV1Schema = z.object({
  version: z.literal(SCHEMA_VERSION),
  lists: z.record(z.string().min(1), wordListEntryV1Schema),
});

export type WordListsV1 = z.infer<typeof wordListsV1Schema>;

export const materialIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._-]+$/, "Material id must be filesystem-safe");

export const fieldTypeSchema = z.enum([
  "text",
  "long_text",
  "single_select",
  "multi_select",
  "date",
  "number",
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

export const fieldOptionV1Schema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shortCode: z.string().min(1).optional(),
});

export type FieldOptionV1 = z.infer<typeof fieldOptionV1Schema>;

export const fieldDependencyV1Schema = z.object({
  fieldKey: z.string().min(1),
  /** Parent option id → allowed option ids for this field. */
  filterOptionsBy: z.record(z.string().min(1), z.array(z.string().min(1))).optional(),
  /** Show this field only when the parent value is one of these option ids / values. */
  visibleWhen: z.array(z.string().min(1)).optional(),
});

export type FieldDependencyV1 = z.infer<typeof fieldDependencyV1Schema>;

export const fieldDefinitionV1Schema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: fieldTypeSchema,
    required: z.boolean(),
    filterable: z.boolean(),
    disabled: z.boolean().optional(),
    options: z.array(fieldOptionV1Schema).optional(),
    dependsOn: fieldDependencyV1Schema.optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "single_select" || field.type === "multi_select") {
      if (!field.options || field.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select fields require at least one option",
          path: ["options"],
        });
      }
    }
  });

export type FieldDefinitionV1 = z.infer<typeof fieldDefinitionV1Schema>;

export const identifierKindV1Schema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
  filterable: z.boolean(),
  disabled: z.boolean().optional(),
});

export type IdentifierKindV1 = z.infer<typeof identifierKindV1Schema>;

export const attachmentKindV1Schema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export type AttachmentKindV1 = z.infer<typeof attachmentKindV1Schema>;

export const materialTableColumnV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("id") }),
  z.object({ kind: z.literal("field"), key: z.string().min(1) }),
  z.object({ kind: z.literal("identifier"), key: z.string().min(1) }),
  z.object({ kind: z.literal("attachments") }),
  z.object({ kind: z.literal("identifiers") }),
]);

export type MaterialTableColumnV1 = z.infer<typeof materialTableColumnV1Schema>;

export function materialTableColumnIdentity(column: MaterialTableColumnV1): string {
  return "key" in column ? `${column.kind}:${column.key}` : column.kind;
}

export const fieldSchemaV1Schema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    fields: z.array(fieldDefinitionV1Schema),
    identifierKinds: z.array(identifierKindV1Schema),
    attachmentKinds: z.array(attachmentKindV1Schema),
    /**
     * Columns used for this library's material list. Missing means shipped defaults.
     * Aggregate multi-library lists use shipped defaults because their schemas may differ.
     */
    tableColumns: z.array(materialTableColumnV1Schema).optional(),
  })
  .superRefine((schema, ctx) => {
    const reserved = new Set(["id", "createdAt", "updatedAt"]);
    for (const [index, field] of schema.fields.entries()) {
      if (reserved.has(field.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field key "${field.key}" is reserved for system material properties`,
          path: ["fields", index, "key"],
        });
      }
    }
  });

export type FieldSchemaV1 = z.infer<typeof fieldSchemaV1Schema>;

export const fieldValueV1Schema = z.union([z.string(), z.number(), z.array(z.string())]);

export type FieldValueV1 = z.infer<typeof fieldValueV1Schema>;

/** Material metadata: system id/timestamps plus field and identifier values by stable key. */
export const materialMetadataV1Schema = z.object({
  version: z.literal(SCHEMA_VERSION),
  id: materialIdSchema,
  fields: z.record(z.string().min(1), fieldValueV1Schema),
  identifiers: z.record(z.string().min(1), z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MaterialMetadataV1 = z.infer<typeof materialMetadataV1Schema>;

export const attachedFileFormatSchema = z.enum(["pdf", "png", "jpg", "jpeg", "tiff", "other"]);

export type AttachedFileFormat = z.infer<typeof attachedFileFormatSchema>;

export const attachedFileSchema = z.object({
  name: z.string().min(1),
  format: attachedFileFormatSchema,
  kindKey: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export type AttachedFile = z.infer<typeof attachedFileSchema>;

export function labelTemplateSizeInches(size: LabelSize): { widthIn: number; heightIn: number } {
  if (size.kind === "catalog") {
    return LABEL_SIZE_CATALOG[size.catalogId];
  }
  return { widthIn: size.widthIn, heightIn: size.heightIn };
}

/** Convert Label Template size to PDF points (72 pt = 1 in). */
export function labelTemplateSizePoints(size: LabelSize): { widthPt: number; heightPt: number } {
  const { widthIn, heightIn } = labelTemplateSizeInches(size);
  return { widthPt: widthIn * 72, heightPt: heightIn * 72 };
}
