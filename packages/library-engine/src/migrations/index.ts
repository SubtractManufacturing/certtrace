import {
  libraryConfigV1Schema,
  materialMetadataV1Schema,
  namingRulesV1Schema,
  wordListsV1Schema,
  type LibraryConfigV1,
  type MaterialMetadataV1,
  type NamingRulesV1,
  type WordListsV1,
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

export function migrateMaterialMetadata(doc: unknown): MaterialMetadataV1 {
  return migrateToCurrent(doc, "metadata.json", {}, materialMetadataV1Schema.parse);
}
