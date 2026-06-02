import { open } from "@tauri-apps/plugin-dialog";
import {
  createLibrary,
  createMaterial,
  listMaterialAttachments,
  listMaterials,
  openLibrary,
  updateLibraryConfig,
  updateMaterial,
  updateNamingRules,
  updateWordLists,
  type CreateLibraryOptions,
  type CreateMaterialInput,
  type OpenLibraryResult,
  type UpdateMaterialInput,
} from "@certtrace/library-engine";
import { joinPath, libraryFolderName } from "@certtrace/types";
import type {
  AttachedFile,
  LibraryConfigV1,
  MaterialMetadataV1,
  NamingRulesV1,
  WordListsV1,
} from "@certtrace/types";
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

export async function fetchMaterials(
  library: OpenLibraryResult,
): Promise<MaterialMetadataV1[]> {
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

export async function updateLibraryConfigPartial(
  library: OpenLibraryResult,
  partial: Partial<Omit<LibraryConfigV1, "version">>,
): Promise<OpenLibraryResult> {
  await updateLibraryConfig(library, partial);
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
  await grantLibraryAccess(path);
  await remove(path, { recursive: true });
}
