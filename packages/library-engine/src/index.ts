import { generateMaterialId } from "@certtrace/id-generator";
import type { FileSystem } from "@certtrace/file-storage";
import {
  CERTTRACE_DIR,
  LABELS_DIR,
  LIBRARY_JSON,
  LIBRARY_PATHS,
  MATERIALS_DIR,
  NAMING_RULES_JSON,
  joinPath,
  materialMetadataPath,
  materialMetadataV1Schema,
  WORD_LISTS_JSON,
  createDefaultLibraryConfigV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
  libraryConfigV1Schema,
  namingRulesV1Schema,
  wordListsV1Schema,
  type LibraryConfigV1,
  type MaterialMetadataV1,
  type NamingRulesV1,
  type WordListsV1,
} from "@certtrace/types";

export class LibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

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

export function getLibraryPaths(root: string): LibraryPaths {
  return {
    root,
    certtrace: joinPath(root, CERTTRACE_DIR),
    materials: joinPath(root, MATERIALS_DIR),
    labels: joinPath(root, LABELS_DIR),
    libraryJson: joinPath(root, LIBRARY_JSON),
    namingRulesJson: joinPath(root, NAMING_RULES_JSON),
    wordListsJson: joinPath(root, WORD_LISTS_JSON),
  };
}

async function writeJson(fs: FileSystem, path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function createLibrary(
  fs: FileSystem,
  root: string,
  name: string,
): Promise<OpenLibraryResult> {
  const paths = getLibraryPaths(root);

  await fs.mkdir(paths.certtrace, { recursive: true });
  await fs.mkdir(paths.materials, { recursive: true });
  await fs.mkdir(paths.labels, { recursive: true });

  const config = createDefaultLibraryConfigV1(name);
  const namingRules = defaultNamingRulesV1;
  const wordLists = defaultWordListsV1;

  await writeJson(fs, paths.libraryJson, config);
  await writeJson(fs, paths.namingRulesJson, namingRules);
  await writeJson(fs, paths.wordListsJson, wordLists);

  return { fs, paths, config, namingRules, wordLists };
}

async function readValidatedJson<T>(
  fs: FileSystem,
  path: string,
  schema: { parse: (value: unknown) => T },
  label: string,
): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(path);
  } catch {
    throw new LibraryError(`Missing ${label} at ${path}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LibraryError(`Invalid JSON in ${label} at ${path}`);
  }

  try {
    return schema.parse(parsed);
  } catch (error) {
    throw new LibraryError(`Invalid ${label} at ${path}: ${String(error)}`);
  }
}

export async function openLibrary(fs: FileSystem, root: string): Promise<OpenLibraryResult> {
  const paths = getLibraryPaths(root);

  const config = await readValidatedJson(
    fs,
    paths.libraryJson,
    libraryConfigV1Schema,
    "library.json",
  );
  const namingRules = await readValidatedJson(
    fs,
    paths.namingRulesJson,
    namingRulesV1Schema,
    "naming-rules.json",
  );
  const wordLists = await readValidatedJson(
    fs,
    paths.wordListsJson,
    wordListsV1Schema,
    "word-lists.json",
  );

  return { fs, paths, config, namingRules, wordLists };
}

function getActiveStrategy(library: OpenLibraryResult) {
  const strategy = library.namingRules.strategies.find(
    (entry) => entry.id === library.config.idStrategy,
  );
  if (!strategy) {
    throw new LibraryError(`Active id strategy not found: ${library.config.idStrategy}`);
  }
  return strategy;
}

export async function listMaterialIds(library: OpenLibraryResult): Promise<string[]> {
  try {
    const entries = await library.fs.readdir(library.paths.materials);
    return entries.filter((entry) => entry.isDirectory).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

export async function listMaterials(library: OpenLibraryResult): Promise<MaterialMetadataV1[]> {
  const ids = await listMaterialIds(library);
  const materials: MaterialMetadataV1[] = [];

  for (const id of ids) {
    materials.push(await getMaterial(library, id));
  }

  return materials;
}

export async function getMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<MaterialMetadataV1> {
  const metadataPath = joinPath(library.paths.root, materialMetadataPath(materialId));
  return readValidatedJson(library.fs, metadataPath, materialMetadataV1Schema, "metadata.json");
}

export async function createMaterial(
  library: OpenLibraryResult,
  input: CreateMaterialInput = {},
): Promise<MaterialMetadataV1> {
  const existingIds = new Set(await listMaterialIds(library));
  const strategy = getActiveStrategy(library);

  const id = generateMaterialId({
    strategy,
    wordLists: library.wordLists,
    existingIds,
    materialCode: input.materialCode,
  });

  const now = new Date().toISOString();
  const metadata: MaterialMetadataV1 = {
    version: 1,
    id,
    material: input.material ?? "",
    supplier: input.supplier ?? "",
    heat: input.heat ?? "",
    location: input.location ?? "",
    tags: input.tags ?? [],
    notes: input.notes ?? "",
    barcode: id,
    createdAt: now,
    updatedAt: now,
  };

  const materialDir = joinPath(library.paths.materials, id);
  await library.fs.mkdir(materialDir, { recursive: true });
  await writeJson(library.fs, joinPath(materialDir, "metadata.json"), metadata);

  return metadata;
}

export async function updateMaterial(
  library: OpenLibraryResult,
  materialId: string,
  input: UpdateMaterialInput,
): Promise<MaterialMetadataV1> {
  const current = await getMaterial(library, materialId);
  const updated: MaterialMetadataV1 = {
    ...current,
    ...input,
    id: current.id,
    version: current.version,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  materialMetadataV1Schema.parse(updated);

  const metadataPath = joinPath(library.paths.root, materialMetadataPath(materialId));
  await writeJson(library.fs, metadataPath, updated);

  return updated;
}

export const LIBRARY_CONTRACT_PATHS = LIBRARY_PATHS;
