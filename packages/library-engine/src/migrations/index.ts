import {
  type FieldSchemaV1,
  fieldSchemaV1Schema,
  type LibraryConfigV1,
  libraryConfigV1Schema,
  type MaterialMetadataV1,
  materialMetadataV1Schema,
  type NamingRulesV1,
  namingRulesV1Schema,
  type WordListsV1,
  wordListsV1Schema,
} from "@certtrace/types";
import { migrateToCurrent } from "./shared.js";

export function migrateLibraryConfig(doc: unknown): LibraryConfigV1 {
  return migrateToCurrent(doc, "library.json", {}, libraryConfigV1Schema.parse);
}

export function migrateNamingRules(doc: unknown): NamingRulesV1 {
  return migrateToCurrent(doc, "naming-rules.json", {}, namingRulesV1Schema.parse);
}

export function migrateWordLists(doc: unknown): WordListsV1 {
  return migrateToCurrent(doc, "word-lists.json", {}, wordListsV1Schema.parse);
}

export function migrateFieldSchema(doc: unknown): FieldSchemaV1 {
  return migrateToCurrent(doc, "field-schema.json", {}, fieldSchemaV1Schema.parse);
}

export function migrateMaterialMetadata(doc: unknown): MaterialMetadataV1 {
  return migrateToCurrent(doc, "metadata.json", {}, materialMetadataV1Schema.parse);
}
