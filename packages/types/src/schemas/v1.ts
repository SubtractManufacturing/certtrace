import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const libraryConfigV1Schema = z.object({
  version: z.literal(SCHEMA_VERSION),
  name: z.string().min(1),
  idStrategy: z.string().min(1),
  labelTemplate: z.string().min(1),
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

export const materialMetadataV1Schema = z.object({
  version: z.literal(SCHEMA_VERSION),
  id: materialIdSchema,
  material: z.string(),
  supplier: z.string(),
  heat: z.string(),
  location: z.string(),
  tags: z.array(z.string()),
  notes: z.string(),
  barcode: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MaterialMetadataV1 = z.infer<typeof materialMetadataV1Schema>;

export const attachedFileKindSchema = z.enum(["pdf", "png", "jpg", "jpeg", "tiff", "other"]);

export type AttachedFileKind = z.infer<typeof attachedFileKindSchema>;

export const attachedFileSchema = z.object({
  name: z.string().min(1),
  kind: attachedFileKindSchema,
  sizeBytes: z.number().int().nonnegative().optional(),
});

export type AttachedFile = z.infer<typeof attachedFileSchema>;

export const labelTemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type LabelTemplate = z.infer<typeof labelTemplateSchema>;
