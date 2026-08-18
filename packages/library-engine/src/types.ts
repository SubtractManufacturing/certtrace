import type { FileSystem } from "@certtrace/file-storage";
import type {
  FieldSchemaV1,
  FieldValueV1,
  LibraryConfigV1,
  NamingRulesV1,
  SizeUnit,
  WordListsV1,
} from "@certtrace/types";

export interface LibraryPaths {
  root: string;
  certtrace: string;
  materials: string;
  jobs: string;
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
  sizeUnit?: SizeUnit;
  /** Explicit unit suffix per dimension key; conflicting suffixes are rejected. */
  dimensionUnits?: Record<string, SizeUnit>;
}

export interface UpdateMaterialInput {
  fields?: Record<string, FieldValueV1>;
  identifiers?: Record<string, string>;
  sizeUnit?: SizeUnit | null;
  /** Explicit unit suffix per dimension key; conflicting suffixes are rejected. */
  dimensionUnits?: Record<string, SizeUnit>;
  /** When true, `fields` replaces the stored field bag instead of merging. */
  replaceFields?: boolean;
}

export interface CreateJobInput {
  jobNumber: string;
  jobDate: string;
  customer?: string;
  notes?: string;
}

export interface UpdateJobInput {
  jobNumber?: string;
  jobDate?: string;
  /** Pass empty string to clear. Omitted leaves unchanged. */
  customer?: string;
  /** Pass empty string to clear. Omitted leaves unchanged. */
  notes?: string;
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
