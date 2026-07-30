import {
  createStarterLabelTemplates,
  type FieldSchemaV1,
  fieldSchemaV1Schema,
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

/** Replace opaque `labelTemplate` string with starter Label Templates (ADR-0007). */
export function migrateLibraryConfigV1ToV2(doc: unknown): unknown {
  if (typeof doc !== "object" || doc === null) {
    throw new LibraryError("Invalid library.json for v1→v2 migration");
  }

  const { labelTemplate: _discarded, ...rest } = doc as Record<string, unknown>;
  return {
    ...rest,
    version: SCHEMA_VERSION,
    labelTemplates: createStarterLabelTemplates(),
    defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
  };
}

export function migrateLibraryConfig(doc: unknown): LibraryConfigV1 {
  return migrateToCurrent(
    doc,
    "library.json",
    { 1: migrateLibraryConfigV1ToV2 },
    libraryConfigV1Schema.parse,
  );
}

export function migrateNamingRules(doc: unknown): NamingRulesV1 {
  return migrateToCurrent(
    doc,
    "naming-rules.json",
    { 1: bumpDocumentVersion },
    namingRulesV1Schema.parse,
  );
}

export function migrateWordLists(doc: unknown): WordListsV1 {
  return migrateToCurrent(
    doc,
    "word-lists.json",
    { 1: bumpDocumentVersion },
    wordListsV1Schema.parse,
  );
}

export function migrateFieldSchema(doc: unknown): FieldSchemaV1 {
  return migrateToCurrent(
    doc,
    "field-schema.json",
    { 1: bumpDocumentVersion },
    fieldSchemaV1Schema.parse,
  );
}

export function migrateMaterialMetadata(doc: unknown): MaterialMetadataV1 {
  return migrateToCurrent(
    doc,
    "metadata.json",
    { 1: bumpDocumentVersion },
    materialMetadataV1Schema.parse,
  );
}
