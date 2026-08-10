import { type FileSystem, isNotFoundError } from "@certtrace/file-storage";
import { generateMaterialId } from "@certtrace/id-generator";
import {
  CERTTRACE_DIR,
  FIELD_SCHEMA_JSON,
  JOBS_DIR,
  joinPath,
  LABELS_DIR,
  LIBRARY_JSON,
  LIBRARY_PATHS,
  LIBRARY_README,
  libraryFolderName,
  MATERIALS_DIR,
  type MaterialMetadataV1,
  materialMetadataPath,
  materialMetadataV1Schema,
  NAMING_RULES_JSON,
  SCHEMA_VERSION,
  WORD_LISTS_JSON,
} from "@certtrace/types";
import { LibraryError } from "./errors.js";
import { removeMaterialFromAllJobAssignments } from "./job-assignments.js";
import {
  buildCreateLibraryConfig,
  type CreateLibraryOptions,
  canReplaceFieldDefinition,
  updateFieldSchema,
} from "./library-config.js";
import {
  migrateFieldSchema,
  migrateLibraryConfig,
  migrateMaterialMetadata,
  migrateNamingRules,
  migrateWordLists,
} from "./migrations/index.js";
import { createLibraryReadme } from "./readme.js";
import type {
  CreateMaterialInput,
  OpenLibraryResult,
  RemoveSchemaDefinitionInput,
  UpdateMaterialInput,
} from "./types.js";

export {
  type AttachFileSource,
  attachFiles,
  attachmentFormatLabel,
  getMaterialAttachmentPath,
  getMaterialFolderPath,
  listMaterialAttachments,
  removeMaterialAttachment,
  renameMaterialAttachment,
} from "./attachments.js";
export { LibraryError } from "./errors.js";
export {
  availableFieldOptions,
  isFieldVisible,
  sanitizeDependentFieldValues,
  validateMaterialValues,
} from "./field-dependencies.js";
export {
  assignMaterialToJob,
  listAssignedMaterialIds,
  listJobsForMaterial,
  listMaterialsForJob,
  unassignMaterialFromJob,
} from "./job-assignments.js";
export {
  createJob,
  filterJobsByCustomer,
  getJob,
  listJobCustomers,
  listJobIds,
  listJobs,
  removeJob,
  updateJob,
} from "./jobs.js";
export {
  type AddFieldOptionInput,
  type AddFieldOptionResult,
  addFieldOption,
  addLabelTemplate,
  addNamingStrategy,
  type CreateLibraryOptions,
  canReplaceFieldDefinition,
  changeFieldType,
  createAttachmentKind,
  createFieldDefinition,
  createFieldOption,
  createIdentifierKind,
  defaultFieldSchemaV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
  deleteLabelTemplate,
  deleteNamingStrategy,
  duplicateNamingStrategy,
  renameNamingStrategy,
  setDefaultLabelTemplate,
  updateFieldSchema,
  updateLabelTemplate,
  updateLibraryConfig,
  updateNamingRules,
  updateWordLists,
  validateStrategyEntropy,
} from "./library-config.js";
export {
  filterableFields,
  filterableIdentifierKinds,
  filterMaterialsByArchiveState,
  filterMaterialsBySchema,
  type MaterialShelfFilter,
  sanitizeMaterialFilterFields,
} from "./material-filters.js";
export type {
  CreateJobInput,
  CreateMaterialInput,
  LibraryPaths,
  MaterialFilterValues,
  OpenLibraryResult,
  RemoveSchemaDefinitionInput,
  SchemaDefinitionRemovalStrategy,
  SchemaDefinitionType,
  UpdateJobInput,
  UpdateMaterialInput,
} from "./types.js";

const METADATA_FILENAME = "metadata.json";

export function getLibraryPaths(root: string) {
  return {
    root,
    certtrace: joinPath(root, CERTTRACE_DIR),
    materials: joinPath(root, MATERIALS_DIR),
    jobs: joinPath(root, JOBS_DIR),
    labels: joinPath(root, LABELS_DIR),
    libraryJson: joinPath(root, LIBRARY_JSON),
    namingRulesJson: joinPath(root, NAMING_RULES_JSON),
    wordListsJson: joinPath(root, WORD_LISTS_JSON),
    fieldSchemaJson: joinPath(root, FIELD_SCHEMA_JSON),
  };
}

async function writeJson(fs: FileSystem, path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function assertNewLibraryRoot(fs: FileSystem, root: string): Promise<void> {
  try {
    const entries = await fs.readdir(root);
    const hasCerttrace = entries.some((entry) => entry.name === CERTTRACE_DIR && entry.isDirectory);
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
  await fs.mkdir(paths.jobs, { recursive: true });
  await fs.mkdir(paths.labels, { recursive: true });

  const { config, namingRules, wordLists, fieldSchema } = buildCreateLibraryConfig(options);

  await writeJson(fs, paths.libraryJson, config);
  await writeJson(fs, paths.namingRulesJson, namingRules);
  await writeJson(fs, paths.wordListsJson, wordLists);
  await writeJson(fs, paths.fieldSchemaJson, fieldSchema);

  return { fs, paths, config, namingRules, wordLists, fieldSchema };
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

function assertNoDisabledDefinitionChanges(
  library: OpenLibraryResult,
  fields: CreateMaterialInput["fields"],
  identifiers: CreateMaterialInput["identifiers"],
  current?: MaterialMetadataV1,
): void {
  for (const field of library.fieldSchema.fields) {
    const nextValue = fields?.[field.key];
    if (
      field.disabled &&
      nextValue !== undefined &&
      (current?.fields[field.key] === undefined ||
        JSON.stringify(current.fields[field.key]) !== JSON.stringify(nextValue))
    ) {
      throw new LibraryError(`Field "${field.label}" is disabled for new entries.`);
    }
  }
  for (const kind of library.fieldSchema.identifierKinds) {
    const nextValue = identifiers?.[kind.key];
    if (
      kind.disabled &&
      nextValue !== undefined &&
      (current?.identifiers[kind.key] === undefined || current.identifiers[kind.key] !== nextValue)
    ) {
      throw new LibraryError(`Identifier kind "${kind.label}" is disabled for new entries.`);
    }
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
  const fieldSchema = await readMigratedJson(
    fs,
    paths.fieldSchemaJson,
    migrateFieldSchema,
    "field-schema.json",
  );

  return { fs, paths, config, namingRules, wordLists, fieldSchema };
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
    return entries
      .filter((entry) => entry.isDirectory)
      .map((entry) => entry.name)
      .sort();
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
  assertNoDisabledDefinitionChanges(library, input.fields, input.identifiers);
  const existingIds = new Set(await listMaterialIds(library));
  const strategy = getActiveStrategy(library);
  const familyOptionId = input.fields?.family;
  const familyField = library.fieldSchema.fields.find((field) => field.key === "family");
  const materialOption =
    typeof familyOptionId === "string"
      ? familyField?.options?.find((option) => option.id === familyOptionId)
      : undefined;

  const id = generateMaterialId({
    strategy,
    wordLists: library.wordLists,
    existingIds,
    materialOption,
  });

  const now = new Date().toISOString();
  const metadata = materialMetadataV1Schema.parse({
    version: SCHEMA_VERSION,
    id,
    fields: input.fields ?? {},
    identifiers: input.identifiers ?? {},
    archived: false,
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
  assertNoDisabledDefinitionChanges(library, input.fields, input.identifiers, current);
  const updated: MaterialMetadataV1 = {
    ...current,
    fields: {
      ...current.fields,
      ...input.fields,
    },
    identifiers: {
      ...current.identifiers,
      ...input.identifiers,
    },
    id: current.id,
    version: current.version,
    archived: current.archived,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  materialMetadataV1Schema.parse(updated);

  const metadataPath = joinPath(library.paths.root, materialMetadataPath(materialId));
  await writeJson(library.fs, metadataPath, updated);

  return updated;
}

async function setMaterialArchived(
  library: OpenLibraryResult,
  materialId: string,
  archived: boolean,
): Promise<MaterialMetadataV1> {
  const current = await getMaterial(library, materialId);
  if (current.archived === archived) {
    return current;
  }

  const updated: MaterialMetadataV1 = {
    ...current,
    archived,
    updatedAt: new Date().toISOString(),
  };
  materialMetadataV1Schema.parse(updated);

  const metadataPath = joinPath(library.paths.root, materialMetadataPath(materialId));
  await writeJson(library.fs, metadataPath, updated);
  return updated;
}

/** Mark a Material as Archived (restorable). Same Library folder and id. */
export async function archiveMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<MaterialMetadataV1> {
  return setMaterialArchived(library, materialId, true);
}

/** Restore an Archived Material to active. */
export async function unarchiveMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<MaterialMetadataV1> {
  return setMaterialArchived(library, materialId, false);
}

/** Permanently remove a material folder (metadata + attachments) and cascade Job assignments. */
export async function removeMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<void> {
  await getMaterial(library, materialId);
  await removeMaterialFromAllJobAssignments(library, materialId);
  await library.fs.remove(joinPath(library.paths.materials, materialId));
}

export async function removeSchemaDefinition(
  library: OpenLibraryResult,
  input: RemoveSchemaDefinitionInput,
): Promise<OpenLibraryResult["fieldSchema"]> {
  const collection =
    input.definitionType === "field"
      ? library.fieldSchema.fields
      : library.fieldSchema.identifierKinds;
  const source = collection.find((definition) => definition.key === input.key);
  if (!source) {
    throw new LibraryError(`Schema ${input.definitionType} "${input.key}" was not found.`);
  }

  if (input.strategy.type === "disable") {
    const nextSchema =
      input.definitionType === "field"
        ? {
            ...library.fieldSchema,
            fields: library.fieldSchema.fields.map((field) =>
              field.key === input.key ? { ...field, disabled: true } : field,
            ),
          }
        : {
            ...library.fieldSchema,
            identifierKinds: library.fieldSchema.identifierKinds.map((kind) =>
              kind.key === input.key ? { ...kind, disabled: true } : kind,
            ),
          };

    return updateFieldSchema(library, nextSchema);
  }

  const targetKey = input.strategy.type === "replace" ? input.strategy.targetKey : undefined;
  if (targetKey === input.key) {
    throw new LibraryError("A schema definition cannot replace itself.");
  }
  const target = targetKey
    ? collection.find((definition) => definition.key === targetKey)
    : undefined;
  if (targetKey && !target) {
    throw new LibraryError(`Replacement target "${targetKey}" was not found.`);
  }
  if (input.definitionType === "field" && targetKey) {
    const sourceField = library.fieldSchema.fields.find((field) => field.key === input.key);
    const targetField = library.fieldSchema.fields.find((field) => field.key === targetKey);
    if (!sourceField || !targetField) {
      throw new LibraryError("Both replacement fields must exist.");
    }
    if (!canReplaceFieldDefinition(sourceField, targetField)) {
      throw new LibraryError(
        "A field can only be replaced by a field of the same type with compatible options.",
      );
    }
  }

  const materials = await listMaterials(library);
  const remappedMaterials = materials.map((material) => {
    const values =
      input.definitionType === "field" ? { ...material.fields } : { ...material.identifiers };
    const sourceValue = values[input.key];
    if (sourceValue === undefined) {
      return material;
    }
    if (targetKey) {
      const targetValue = values[targetKey];
      if (
        targetValue !== undefined &&
        JSON.stringify(targetValue) !== JSON.stringify(sourceValue)
      ) {
        throw new LibraryError(
          `Material "${material.id}" already has a different value for "${targetKey}".`,
        );
      }
      values[targetKey] = sourceValue;
    }
    delete values[input.key];

    return {
      ...material,
      ...(input.definitionType === "field" ? { fields: values } : { identifiers: values }),
      updatedAt: new Date().toISOString(),
    } as MaterialMetadataV1;
  });

  const nextSchema =
    input.definitionType === "field"
      ? {
          ...library.fieldSchema,
          fields: library.fieldSchema.fields
            .filter((field) => field.key !== input.key)
            .map((field) => {
              if (field.dependsOn?.fieldKey !== input.key) {
                return field;
              }
              if (!targetKey || field.key === targetKey) {
                const { dependsOn: _dependsOn, ...withoutDependency } = field;
                return withoutDependency;
              }
              return {
                ...field,
                dependsOn: { ...field.dependsOn, fieldKey: targetKey },
              };
            }),
        }
      : {
          ...library.fieldSchema,
          identifierKinds: library.fieldSchema.identifierKinds.filter(
            (kind) => kind.key !== input.key,
          ),
        };

  const changedMaterials = remappedMaterials.filter(
    (material, index) => material !== materials[index],
  );
  try {
    for (const material of changedMaterials) {
      await writeJson(
        library.fs,
        joinPath(library.paths.root, materialMetadataPath(material.id)),
        material,
      );
    }
    return await updateFieldSchema(library, nextSchema);
  } catch (error) {
    for (const material of materials) {
      if (changedMaterials.some((changed) => changed.id === material.id)) {
        await writeJson(
          library.fs,
          joinPath(library.paths.root, materialMetadataPath(material.id)),
          material,
        ).catch(() => undefined);
      }
    }
    throw error;
  }
}

export const LIBRARY_CONTRACT_PATHS = LIBRARY_PATHS;
