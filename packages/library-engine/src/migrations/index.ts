import {
  createLabelContentItem,
  createStarterLabelTemplates,
  defaultFieldSchemaV1,
  type FieldSchemaV1,
  fieldSchemaV1Schema,
  isShippedDimensionKey,
  type LabelContentItem,
  type LibraryConfigV1,
  libraryConfigV1Schema,
  type MaterialMetadataV1,
  materialMetadataV1Schema,
  type NamingRulesV1,
  namingRulesV1Schema,
  SCHEMA_VERSION,
  SHIPPED_SHAPE_PACKING,
  STARTER_LABEL_TEMPLATE_4X6_ID,
  type WordListsV1,
  wordListsV1Schema,
} from "@certtrace/types";
import { LibraryError } from "../errors.js";
import { migrateToCurrent } from "./shared.js";

function bumpDocumentVersion(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid document for schema migration");
  }
  return { ...doc, version: SCHEMA_VERSION };
}

function bumpDocumentToVersion(doc: unknown, version: number): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid document for schema migration");
  }
  return { ...doc, version };
}

/** Replace opaque `labelTemplate` string with starter Label Templates (ADR-0007). */
export function migrateLibraryConfigV1ToV2(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid library.json for v1→v2 migration");
  }

  const { labelTemplate: _discarded, ...rest } = doc as Record<string, unknown>;
  // Emit the v2 `contentKeys` shape; v2→v3 upgrades to structured `content`.
  const v2Starters = createStarterLabelTemplates().map((template) => ({
    id: template.id,
    name: template.name,
    size: template.size,
    displayUnit: template.displayUnit,
    contentKeys: template.content.map((item) => item.key),
  }));
  return {
    ...rest,
    version: 2,
    labelTemplates: v2Starters,
    defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
  };
}

function migrateLabelTemplateV2ToV3(template: Record<string, unknown>): Record<string, unknown> {
  const { contentKeys, content: existingContent, ...rest } = template;

  if (Array.isArray(existingContent) && existingContent.length > 0) {
    return {
      ...rest,
      content: existingContent.map((entry) => {
        if (typeof entry === "string") {
          return createLabelContentItem(entry);
        }
        if (typeof entry === "object" && entry !== null && "key" in entry) {
          const item = entry as Partial<LabelContentItem> & { key: string };
          return createLabelContentItem(item.key, {
            align: item.align,
            size: item.size,
          });
        }
        throw new LibraryError("Invalid label template content item in v2→v3 migration");
      }),
    };
  }

  if (!Array.isArray(contentKeys) || contentKeys.length === 0) {
    throw new LibraryError("Invalid label template contentKeys in v2→v3 migration");
  }

  return {
    ...rest,
    content: contentKeys.map((key) => {
      if (typeof key !== "string" || key.length === 0) {
        throw new LibraryError("Invalid label template content key in v2→v3 migration");
      }
      return createLabelContentItem(key);
    }),
  };
}

/** Convert `contentKeys: string[]` to structured `content` items with align/size. */
export function migrateLibraryConfigV2ToV3(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid library.json for v2→v3 migration");
  }

  const record = doc as Record<string, unknown>;
  if (!Array.isArray(record.labelTemplates)) {
    throw new LibraryError("Invalid library.json labelTemplates in v2→v3 migration");
  }

  return {
    ...record,
    version: 3,
    labelTemplates: record.labelTemplates.map((template) => {
      if (typeof template !== "object" || template === null) {
        throw new LibraryError("Invalid label template in v2→v3 migration");
      }
      return migrateLabelTemplateV2ToV3(template as Record<string, unknown>);
    }),
  };
}

function shippedDimensionFieldsFromSeed() {
  return defaultFieldSchemaV1.fields.filter(
    (field) => field.type === "number" && isShippedDimensionKey(field.key),
  );
}

/** Add dimension fields and pack shipped Shape option ids (ADR-0015). */
export function migrateFieldSchemaV3ToV4(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid field-schema.json for v3→v4 migration");
  }

  const record = doc as FieldSchemaV1;
  const existingKeys = new Set(record.fields.map((field) => field.key));
  const nextFields = [...record.fields];

  for (const dimensionField of shippedDimensionFieldsFromSeed()) {
    if (!existingKeys.has(dimensionField.key)) {
      nextFields.push(dimensionField);
    }
  }

  const shapeIndex = nextFields.findIndex((field) => field.key === "shape");
  if (shapeIndex >= 0) {
    const shapeField = nextFields[shapeIndex]!;
    const existingOptions = shapeField.options ?? [];
    const optionById = new Map(existingOptions.map((option) => [option.id, option]));

    if (!optionById.has("rect_bar")) {
      const rectBarSeed = defaultFieldSchemaV1.fields
        .find((field) => field.key === "shape")
        ?.options?.find((option) => option.id === "rect_bar");
      if (rectBarSeed) {
        existingOptions.push(rectBarSeed);
        optionById.set("rect_bar", rectBarSeed);
      }
    }

    const packedOptions = existingOptions.map((option) => {
      const packing = SHIPPED_SHAPE_PACKING[option.id];
      if (!packing) {
        return option;
      }
      return {
        ...option,
        dimensionKeys: packing.dimensionKeys,
        sizePattern: packing.sizePattern,
      };
    });

    nextFields[shapeIndex] = {
      ...shapeField,
      options: packedOptions,
    };
  }

  return {
    ...record,
    version: 4,
    fields: nextFields,
  };
}

/** Add library `defaultUnit` when absent (ADR-0014). */
export function migrateLibraryConfigV3ToV4(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid library.json for v3→v4 migration");
  }

  const record = doc as Record<string, unknown>;
  return {
    ...record,
    version: 4,
    defaultUnit: record.defaultUnit ?? "app",
  };
}

export function migrateLibraryConfig(doc: unknown): LibraryConfigV1 {
  return migrateToCurrent(
    doc,
    "library.json",
    {
      1: migrateLibraryConfigV1ToV2,
      2: migrateLibraryConfigV2ToV3,
      3: migrateLibraryConfigV3ToV4,
    },
    libraryConfigV1Schema.parse,
  );
}

export function migrateNamingRules(doc: unknown): NamingRulesV1 {
  return migrateToCurrent(
    doc,
    "naming-rules.json",
    {
      1: (value) => bumpDocumentToVersion(value, 2),
      2: (value) => bumpDocumentToVersion(value, 3),
      3: bumpDocumentVersion,
    },
    namingRulesV1Schema.parse,
  );
}

export function migrateWordLists(doc: unknown): WordListsV1 {
  return migrateToCurrent(
    doc,
    "word-lists.json",
    {
      1: (value) => bumpDocumentToVersion(value, 2),
      2: (value) => bumpDocumentToVersion(value, 3),
      3: bumpDocumentVersion,
    },
    wordListsV1Schema.parse,
  );
}

export function migrateFieldSchema(doc: unknown): FieldSchemaV1 {
  return migrateToCurrent(
    doc,
    "field-schema.json",
    {
      1: (value) => bumpDocumentToVersion(value, 2),
      2: (value) => bumpDocumentToVersion(value, 3),
      3: migrateFieldSchemaV3ToV4,
    },
    fieldSchemaV1Schema.parse,
  );
}

export function migrateMaterialMetadata(doc: unknown): MaterialMetadataV1 {
  return migrateToCurrent(
    doc,
    "metadata.json",
    {
      1: (value) => bumpDocumentToVersion(value, 2),
      2: (value) => bumpDocumentToVersion(value, 3),
      3: bumpDocumentVersion,
    },
    materialMetadataV1Schema.parse,
  );
}
