import { isNotFoundError } from "@certtrace/file-storage";
import {
  type AddFieldOptionInput,
  type AddFieldOptionResult,
  addFieldOption,
  type CreateLibraryOptions,
  type CreateMaterialInput,
  createLibrary,
  createMaterial,
  removeMaterial,
  listMaterialAttachments,
  listMaterials,
  type OpenLibraryResult,
  openLibrary,
  type RemoveSchemaDefinitionInput,
  removeSchemaDefinition,
  type UpdateMaterialInput,
  updateFieldSchema,
  updateLibraryConfig,
  updateMaterial,
  updateNamingRules,
  updateWordLists,
} from "@certtrace/library-engine";
import type {
  AttachedFile,
  FieldSchemaV1,
  LibraryConfigV1,
  MaterialMetadataV1,
  NamingRulesV1,
  WordListsV1,
} from "@certtrace/types";
import { joinPath, libraryFolderName } from "@certtrace/types";
import { open } from "@tauri-apps/plugin-dialog";
import { recordRecentLibrary } from "./app-settings-client";
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
