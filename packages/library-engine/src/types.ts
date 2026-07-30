import type { FileSystem } from "@certtrace/file-storage";
import type {
  FieldSchemaV1,
  FieldValueV1,
  LibraryConfigV1,
  NamingRulesV1,
  WordListsV1,
} from "@certtrace/types";

export interface LibraryPaths {
  root: string;
  certtrace: string;
  materials: string;
  labels: string;
  libraryJson: string;
  namingRulesJson: string;
  wordListsJson: string;
  fieldSchemaJson: string;
}

export interface OpenLibraryResult {
  fs: FileSystem;
  paths: LibraryPaths;
  config: LibraryConfigV1;
  namingRules: NamingRulesV1;
  wordLists: WordListsV1;
  fieldSchema: FieldSchemaV1;
}

export interface CreateMaterialInput {
  fields?: Record<string, FieldValueV1>;
  identifiers?: Record<string, string>;
}

export interface UpdateMaterialInput {
  fields?: Record<string, FieldValueV1>;
  identifiers?: Record<string, string>;
}

export interface MaterialFilterValues {
  fields: Record<string, string>;
  identifiers: Record<string, string>;
}

export type SchemaDefinitionType = "field" | "identifierKind";

export type SchemaDefinitionRemovalStrategy =
  | { type: "disable" }
  | { type: "delete" }
  | { type: "replace"; targetKey: string };

export interface RemoveSchemaDefinitionInput {
  definitionType: SchemaDefinitionType;
  key: string;
  strategy: SchemaDefinitionRemovalStrategy;
}
