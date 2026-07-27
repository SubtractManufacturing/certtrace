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
  /** Prefix/code used in ID templates (`{material}` token), e.g. `AL`. */
  materialCode?: string;
}

export interface UpdateMaterialInput {
  fields?: Record<string, FieldValueV1>;
  identifiers?: Record<string, string>;
}
