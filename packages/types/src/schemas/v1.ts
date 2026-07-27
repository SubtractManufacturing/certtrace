import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const libraryConfigV1Schema = z.object({
  version: z.literal(SCHEMA_VERSION),
  name: z.string().min(1),
  idStrategy: z.string().min(1),
  labelTemplate: z.string().min(1),
  /** Legacy compatibility only. Search is always material ID plus identifier values (ADR-0004). */
  searchAllFields: z.boolean(),
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
});

export type IdentifierKindV1 = z.infer<typeof identifierKindV1Schema>;

export const attachmentKindV1Schema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export type AttachmentKindV1 = z.infer<typeof attachmentKindV1Schema>;

export const fieldSchemaV1Schema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    fields: z.array(fieldDefinitionV1Schema),
    identifierKinds: z.array(identifierKindV1Schema),
    attachmentKinds: z.array(attachmentKindV1Schema),
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

export const labelTemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type LabelTemplate = z.infer<typeof labelTemplateSchema>;
