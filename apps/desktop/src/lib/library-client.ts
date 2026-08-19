import { isNotFoundError } from "@certtrace/file-storage";
import {
  type AddFieldOptionInput,
  type AddFieldOptionResult,
  addFieldOption,
  archiveMaterial as archiveMaterialInLibrary,
  assertRestoreDestinationFree,
  assignMaterialToJob as assignMaterialToJobInLibrary,
  type CreateJobInput,
  type CreateLibraryOptions,
  type CreateMaterialInput,
  createJob,
  createLibrary,
  createMaterial,
  findLibraryRootPrefix,
  libraryBackupSuggestedFileName,
  libraryRestoreDestination,
  listAssignedMaterialIds,
  listJobCustomers,
  listJobs,
  listJobsForMaterial,
  listMaterialAttachments,
  listMaterials,
  listMaterialsForJob,
  type OpenLibraryResult,
  openLibrary,
  parseLibraryNameFromConfigJson,
  type RemoveSchemaDefinitionInput,
  removeJob,
  removeMaterial,
  removeSchemaDefinition,
  type UpdateJobInput,
  type UpdateMaterialInput,
  unarchiveMaterial as unarchiveMaterialInLibrary,
  unassignMaterialFromJob as unassignMaterialFromJobInLibrary,
  updateFieldSchema,
  updateJob,
  updateLibraryConfig,
  updateMaterial,
  updateNamingRules,
  updateWordLists,
} from "@certtrace/library-engine";
import type {
  AttachedFile,
  FieldSchemaV1,
  JobMetadataV1,
  LibraryConfigV1,
  MaterialMetadataV1,
  NamingRulesV1,
  WordListsV1,
} from "@certtrace/types";
import {
  joinPath,
  LIBRARY_BACKUP_SKIP_NAMES,
  LIBRARY_BACKUP_SKIP_PREFIXES,
  LIBRARY_JSON,
  libraryFolderName,
} from "@certtrace/types";
import { open, save } from "@tauri-apps/plugin-dialog";
import { recordRecentLibrary } from "./app-settings-client";
import {
  listZipEntries,
  readZipEntryText,
  unzipLibraryDir,
  zipLibraryDir,
} from "./library-archive-client";
import { allowLibraryDirectory } from "./library-scope";
import { createTauriFileSystem } from "./tauri-fs";

const fs = createTauriFileSystem();

interface GrantLibraryAccessOptions {
  recursive?: boolean;
}

async function grantLibraryAccess(
  path: string,
  options: GrantLibraryAccessOptions = {},
): Promise<void> {
  await allowLibraryDirectory(path, { recursive: options.recursive ?? true });
}

export async function pickParentFolder(title: string): Promise<string | null> {
  const selected = await open({
    title,
    directory: true,
    multiple: false,
  });

  if (selected === null || Array.isArray(selected)) {
    return null;
  }

  return selected;
}

function parentPath(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (separatorIndex < 0) {
    return trimmed;
  }
  return separatorIndex === 0 ? trimmed.slice(0, 1) : trimmed.slice(0, separatorIndex);
}

function folderNameFromPath(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return separatorIndex < 0 ? trimmed : trimmed.slice(separatorIndex + 1);
}

export async function pickLibraryBackupZip(): Promise<string | null> {
  const selected = await open({
    title: "Choose a library backup",
    multiple: false,
    filters: [{ name: "ZIP", extensions: ["zip"] }],
  });

  if (selected === null || Array.isArray(selected)) {
    return null;
  }

  return selected;
}

export async function pickLibraryBackupSavePath(libraryRoot: string): Promise<string | null> {
  const selected = await save({
    title: "Save library backup",
    defaultPath: libraryBackupSuggestedFileName(folderNameFromPath(libraryRoot), new Date()),
    filters: [{ name: "ZIP", extensions: ["zip"] }],
  });

  return selected ?? null;
}

export async function inspectLibraryBackup(
  zipPath: string,
): Promise<{ name: string; prefix: string }> {
  await grantLibraryAccess(parentPath(zipPath), { recursive: false });
  const entries = await listZipEntries(zipPath);
  const prefix = findLibraryRootPrefix(entries);
  const libraryJsonPath = prefix ? `${prefix}/${LIBRARY_JSON}` : LIBRARY_JSON;
  const raw = await readZipEntryText(zipPath, libraryJsonPath);
  return {
    name: parseLibraryNameFromConfigJson(raw),
    prefix,
  };
}

export async function backupLibraryAtPath(libraryRoot: string, destZip: string): Promise<void> {
  await grantLibraryAccess(libraryRoot);
  await grantLibraryAccess(parentPath(destZip), { recursive: false });
  await zipLibraryDir(
    libraryRoot,
    destZip,
    LIBRARY_BACKUP_SKIP_PREFIXES,
    LIBRARY_BACKUP_SKIP_NAMES,
  );
}

export async function restoreLibraryFromBackup(
  zipPath: string,
  parentDir: string,
): Promise<OpenLibraryResult> {
  const inspected = await inspectLibraryBackup(zipPath);
  const dest = libraryRestoreDestination(parentDir, inspected.name);
  await grantLibraryAccess(parentDir, { recursive: false });
  await grantLibraryAccess(dest);
  await assertRestoreDestinationFree(fs, dest);

  try {
    await unzipLibraryDir(zipPath, dest, inspected.prefix);
    return await openLibraryAtPath(dest);
  } catch (error) {
    try {
      await deleteLibraryFolder(dest);
    } catch (cleanupError) {
      console.error(cleanupError);
    }
    throw error;
  }
}

export async function openLibraryAtPath(root: string): Promise<OpenLibraryResult> {
  await grantLibraryAccess(root);
  const library = await openLibrary(fs, root);
  await recordRecentLibrary(library.paths.root, library.config.name);
  return library;
}

export async function createLibraryAtPath(
  parentDir: string,
  name: string,
): Promise<OpenLibraryResult> {
  return createLibraryWithOptions(parentDir, { name });
}

export async function createLibraryWithOptions(
  parentDir: string,
  options: CreateLibraryOptions,
): Promise<OpenLibraryResult> {
  await grantLibraryAccess(parentDir, { recursive: false });
  const root = joinPath(parentDir, libraryFolderName(options.name));
  await grantLibraryAccess(root);
  const library = await createLibrary(fs, parentDir, options);
  await grantLibraryAccess(library.paths.root);
  await recordRecentLibrary(library.paths.root, library.config.name);
  return library;
}

export async function reloadLibraryAtPath(root: string): Promise<OpenLibraryResult> {
  return openLibrary(fs, root);
}

export async function fetchMaterials(library: OpenLibraryResult): Promise<MaterialMetadataV1[]> {
  return listMaterials(library);
}

export async function addMaterial(
  library: OpenLibraryResult,
  input: CreateMaterialInput,
): Promise<MaterialMetadataV1> {
  return createMaterial(library, input);
}

export async function updateMaterialMetadata(
  library: OpenLibraryResult,
  materialId: string,
  input: UpdateMaterialInput,
): Promise<MaterialMetadataV1> {
  return updateMaterial(library, materialId, input);
}

export async function deleteMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<void> {
  return removeMaterial(library, materialId);
}

export async function archiveMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<MaterialMetadataV1> {
  return archiveMaterialInLibrary(library, materialId);
}

export async function unarchiveMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<MaterialMetadataV1> {
  return unarchiveMaterialInLibrary(library, materialId);
}

export async function fetchJobs(library: OpenLibraryResult): Promise<JobMetadataV1[]> {
  return listJobs(library);
}

export async function addJob(
  library: OpenLibraryResult,
  input: CreateJobInput,
): Promise<JobMetadataV1> {
  return createJob(library, input);
}

export async function updateJobMetadata(
  library: OpenLibraryResult,
  jobId: string,
  input: UpdateJobInput,
): Promise<JobMetadataV1> {
  return updateJob(library, jobId, input);
}

export async function deleteJob(library: OpenLibraryResult, jobId: string): Promise<void> {
  return removeJob(library, jobId);
}

export async function fetchJobCustomers(library: OpenLibraryResult): Promise<string[]> {
  return listJobCustomers(library);
}

export async function assignMaterialToJob(
  library: OpenLibraryResult,
  jobId: string,
  materialId: string,
): Promise<void> {
  return assignMaterialToJobInLibrary(library, jobId, materialId);
}

export async function unassignMaterialFromJob(
  library: OpenLibraryResult,
  jobId: string,
  materialId: string,
): Promise<void> {
  return unassignMaterialFromJobInLibrary(library, jobId, materialId);
}

export async function fetchMaterialsForJob(
  library: OpenLibraryResult,
  jobId: string,
): Promise<MaterialMetadataV1[]> {
  return listMaterialsForJob(library, jobId);
}

export async function fetchAssignedMaterialIds(
  library: OpenLibraryResult,
  jobId: string,
): Promise<string[]> {
  return listAssignedMaterialIds(library, jobId);
}

export async function fetchJobsForMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<JobMetadataV1[]> {
  return listJobsForMaterial(library, materialId);
}

export async function addLibraryFieldOption(
  library: OpenLibraryResult,
  input: AddFieldOptionInput,
): Promise<AddFieldOptionResult> {
  return addFieldOption(library, input);
}

export async function updateLibraryConfigPartial(
  library: OpenLibraryResult,
  partial: Partial<Omit<LibraryConfigV1, "version">>,
): Promise<OpenLibraryResult> {
  await updateLibraryConfig(library, partial);
  return reloadLibraryAtPath(library.paths.root);
}

export async function updateLibraryFieldSchema(
  library: OpenLibraryResult,
  schema: FieldSchemaV1,
): Promise<OpenLibraryResult> {
  await updateFieldSchema(library, schema);
  return reloadLibraryAtPath(library.paths.root);
}

export async function removeLibrarySchemaDefinition(
  library: OpenLibraryResult,
  input: RemoveSchemaDefinitionInput,
): Promise<OpenLibraryResult> {
  await removeSchemaDefinition(library, input);
  return reloadLibraryAtPath(library.paths.root);
}

export async function updateLibraryNamingRules(
  library: OpenLibraryResult,
  rules: NamingRulesV1,
): Promise<OpenLibraryResult> {
  await updateNamingRules(library, rules);
  return reloadLibraryAtPath(library.paths.root);
}

export async function updateLibraryWordLists(
  library: OpenLibraryResult,
  lists: WordListsV1,
): Promise<OpenLibraryResult> {
  await updateWordLists(library, lists);
  return reloadLibraryAtPath(library.paths.root);
}

export async function fetchMaterialAttachments(
  library: OpenLibraryResult,
  materialId: string,
): Promise<AttachedFile[]> {
  return listMaterialAttachments(library, materialId);
}

export async function deleteLibraryFolder(path: string): Promise<void> {
  const { remove } = await import("@tauri-apps/plugin-fs");

  try {
    await grantLibraryAccess(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }

  try {
    await remove(path, { recursive: true });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
}
