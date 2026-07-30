import {
  createLabelContentItem,
  createStarterLabelTemplates,
  type FieldSchemaV1,
  fieldSchemaV1Schema,
  type LabelContentItem,
  type LibraryConfigV1,
  libraryConfigV1Schema,
  type MaterialMetadataV1,
  materialMetadataV1Schema,
  type NamingRulesV1,
  namingRulesV1Schema,
  SCHEMA_VERSION,
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

export function migrateLibraryConfig(doc: unknown): LibraryConfigV1 {
  return migrateToCurrent(
    doc,
    "library.json",
    {
      1: migrateLibraryConfigV1ToV2,
      2: migrateLibraryConfigV2ToV3,
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
      2: bumpDocumentVersion,
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
      2: bumpDocumentVersion,
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
      2: bumpDocumentVersion,
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
      2: bumpDocumentVersion,
    },
    materialMetadataV1Schema.parse,
  );
}
