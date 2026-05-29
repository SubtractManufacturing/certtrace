import { open } from "@tauri-apps/plugin-dialog";
import {
  createLibrary,
  createMaterial,
  listMaterials,
  openLibrary,
  type CreateMaterialInput,
  type OpenLibraryResult,
} from "@certtrace/library-engine";
import type { MaterialMetadataV1 } from "@certtrace/types";
import { createTauriFileSystem } from "./tauri-fs";

const fs = createTauriFileSystem();

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
  return openLibrary(fs, root);
}

export async function createLibraryAtPath(
  parentDir: string,
  name: string,
): Promise<OpenLibraryResult> {
  return createLibrary(fs, parentDir, name);
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
