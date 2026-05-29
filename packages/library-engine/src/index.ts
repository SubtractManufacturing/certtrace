import { generateMaterialId } from "@certtrace/id-generator";
import { isNotFoundError, type FileSystem } from "@certtrace/file-storage";
import {
  CERTTRACE_DIR,
  LABELS_DIR,
  LIBRARY_JSON,
  LIBRARY_PATHS,
  LIBRARY_README,
  MATERIALS_DIR,
  NAMING_RULES_JSON,
  joinPath,
  libraryFolderName,
  materialMetadataPath,
  WORD_LISTS_JSON,
  materialMetadataV1Schema,
  type MaterialMetadataV1,
} from "@certtrace/types";
import { createLibraryReadme } from "./readme.js";
import {
  migrateLibraryConfig,
  migrateMaterialMetadata,
  migrateNamingRules,
  migrateWordLists,
} from "./migrations/index.js";
import { LibraryError } from "./errors.js";
import { buildCreateLibraryConfig, type CreateLibraryOptions } from "./library-config.js";
import type { CreateMaterialInput, OpenLibraryResult, UpdateMaterialInput } from "./types.js";

export {
  type LibraryPaths,
  type OpenLibraryResult,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from "./types.js";
export { LibraryError } from "./errors.js";
export {
  type CreateLibraryOptions,
  updateLibraryConfig,
  updateNamingRules,
  updateWordLists,
  addNamingStrategy,
  duplicateNamingStrategy,
  renameNamingStrategy,
  deleteNamingStrategy,
  validateStrategyEntropy,
  defaultNamingRulesV1,
  defaultWordListsV1,
} from "./library-config.js";
export {
  listMaterialAttachments,
  attachFiles,
  removeMaterialAttachment,
  getMaterialAttachmentPath,
  getMaterialFolderPath,
  attachmentKindLabel,
  type AttachFileSource,
} from "./attachments.js";

const METADATA_FILENAME = "metadata.json";

export function getLibraryPaths(root: string) {
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

async function assertNewLibraryRoot(fs: FileSystem, root: string): Promise<void> {
  try {
    const entries = await fs.readdir(root);
    const hasCerttrace = entries.some(
      (entry) => entry.name === CERTTRACE_DIR && entry.isDirectory,
    );
    if (hasCerttrace) {
      throw new LibraryError(`A CertTrace library already exists at ${root}`);
    }
  } catch (error: unknown) {
    if (error instanceof LibraryError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return;
    }
    throw new LibraryError(`Unable to inspect library root at ${root}: ${String(error)}`);
  }
}

export async function createLibrary(
  fs: FileSystem,
  parentDir: string,
  nameOrOptions: string | CreateLibraryOptions,
): Promise<OpenLibraryResult> {
  const options: CreateLibraryOptions =
    typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;

  let folderName: string;
  try {
    folderName = libraryFolderName(options.name);
  } catch {
    throw new LibraryError("Library name cannot be empty");
  }

  const root = joinPath(parentDir, folderName);
  await fs.mkdir(parentDir, { recursive: true });
  await assertNewLibraryRoot(fs, root);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(joinPath(root, LIBRARY_README), createLibraryReadme(options.name.trim()));

  const paths = getLibraryPaths(root);

  await fs.mkdir(paths.certtrace, { recursive: true });
  await fs.mkdir(paths.materials, { recursive: true });
  await fs.mkdir(paths.labels, { recursive: true });

  const { config, namingRules, wordLists } = buildCreateLibraryConfig(options);

  await writeJson(fs, paths.libraryJson, config);
  await writeJson(fs, paths.namingRulesJson, namingRules);
  await writeJson(fs, paths.wordListsJson, wordLists);

  return { fs, paths, config, namingRules, wordLists };
}

async function readMigratedJson<T>(
  fs: FileSystem,
  path: string,
  migrate: (doc: unknown) => T,
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
    return migrate(parsed);
  } catch (error) {
    if (error instanceof LibraryError) {
      throw error;
    }
    throw new LibraryError(`Invalid ${label} at ${path}: ${String(error)}`);
  }
}

export async function openLibrary(fs: FileSystem, root: string): Promise<OpenLibraryResult> {
  const paths = getLibraryPaths(root);

  const config = await readMigratedJson(
    fs,
    paths.libraryJson,
    migrateLibraryConfig,
    "library.json",
  );
  const namingRules = await readMigratedJson(
    fs,
    paths.namingRulesJson,
    migrateNamingRules,
    "naming-rules.json",
  );
  const wordLists = await readMigratedJson(
    fs,
    paths.wordListsJson,
    migrateWordLists,
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
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw new LibraryError(
      `Unable to list materials in ${library.paths.materials}: ${String(error)}`,
    );
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
  return readMigratedJson(library.fs, metadataPath, migrateMaterialMetadata, "metadata.json");
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
  const metadata = materialMetadataV1Schema.parse({
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
  });

  const materialDirPath = joinPath(library.paths.materials, id);
  await library.fs.mkdir(materialDirPath, { recursive: true });
  await writeJson(library.fs, joinPath(materialDirPath, METADATA_FILENAME), metadata);

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
