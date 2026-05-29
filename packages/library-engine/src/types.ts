import type { FileSystem } from "@certtrace/file-storage";
import type { LibraryConfigV1, NamingRulesV1, WordListsV1 } from "@certtrace/types";

export interface LibraryPaths {
  root: string;
  certtrace: string;
  materials: string;
  labels: string;
  libraryJson: string;
  namingRulesJson: string;
  wordListsJson: string;
}

export interface OpenLibraryResult {
  fs: FileSystem;
  paths: LibraryPaths;
  config: LibraryConfigV1;
  namingRules: NamingRulesV1;
  wordLists: WordListsV1;
}

export interface CreateMaterialInput {
  material?: string;
  supplier?: string;
  heat?: string;
  location?: string;
  tags?: string[];
  notes?: string;
  /** Prefix/code used in ID templates (`{material}` token), e.g. `AL`. */
  materialCode?: string;
}

export interface UpdateMaterialInput {
  material?: string;
  supplier?: string;
  heat?: string;
  location?: string;
  tags?: string[];
  notes?: string;
  barcode?: string;
}
