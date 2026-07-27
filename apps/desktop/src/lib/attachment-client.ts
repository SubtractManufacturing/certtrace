import {
  attachFiles,
  getMaterialAttachmentPath,
  type OpenLibraryResult,
  removeMaterialAttachment,
  renameMaterialAttachment,
} from "@certtrace/library-engine";
import type { AttachedFile } from "@certtrace/types";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export async function pickAttachmentFiles(): Promise<string[]> {
  const selected = await open({
    title: "Choose files to attach",
    multiple: true,
  });

  if (selected === null) {
    return [];
  }

  return Array.isArray(selected) ? selected : [selected];
}

export async function attachFilesToMaterial(
  library: OpenLibraryResult,
  materialId: string,
  sourcePaths: string[],
  kindKey?: string,
): Promise<AttachedFile[]> {
  if (sourcePaths.length === 0) {
    return [];
  }

  return attachFiles(
    library,
    materialId,
    sourcePaths.map((sourcePath) => ({ sourcePath, kindKey })),
  );
}

export async function renameAttachment(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
  nextFilename: string,
): Promise<AttachedFile> {
  return renameMaterialAttachment(library, materialId, filename, nextFilename);
}

export async function deleteAttachment(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
): Promise<void> {
  return removeMaterialAttachment(library, materialId, filename);
}

export async function revealAttachmentInFolder(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
): Promise<void> {
  await invoke("reveal_local_path", {
    path: getMaterialAttachmentPath(library, materialId, filename),
  });
}
