import { inferAttachmentKind, uniqueAttachmentName } from "@certtrace/file-storage";
import type { AttachedFile, AttachedFileKind } from "@certtrace/types";
import { joinPath } from "@certtrace/types";
import { LibraryError } from "./errors.js";
import type { OpenLibraryResult } from "./types.js";

const METADATA_FILENAME = "metadata.json";

export function getMaterialFolderPath(library: OpenLibraryResult, materialId: string): string {
  return joinPath(library.paths.materials, materialId);
}

export function getMaterialAttachmentPath(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
): string {
  return joinPath(getMaterialFolderPath(library, materialId), filename);
}

export async function listMaterialAttachments(
  library: OpenLibraryResult,
  materialId: string,
): Promise<AttachedFile[]> {
  const folder = getMaterialFolderPath(library, materialId);
  let entries;
  try {
    entries = await library.fs.readdir(folder);
  } catch {
    return [];
  }

  const attachments: AttachedFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory || entry.name === METADATA_FILENAME) {
      continue;
    }

    const kind = inferAttachmentKind(entry.name) as AttachedFileKind;
    attachments.push({ name: entry.name, kind });
  }

  return attachments.sort((left, right) => left.name.localeCompare(right.name));
}

export interface AttachFileSource {
  sourcePath: string;
  filename?: string;
}

export async function attachFiles(
  library: OpenLibraryResult,
  materialId: string,
  sources: AttachFileSource[],
): Promise<AttachedFile[]> {
  if (sources.length === 0) {
    return listMaterialAttachments(library, materialId);
  }

  const existing = new Set(
    (await listMaterialAttachments(library, materialId)).map((file) => file.name),
  );
  const added: AttachedFile[] = [];

  for (const source of sources) {
    const baseName =
      source.filename ?? source.sourcePath.split(/[/\\]/).pop() ?? "attachment";
    const targetName = uniqueAttachmentName(baseName, existing);
    const targetPath = getMaterialAttachmentPath(library, materialId, targetName);

    await library.fs.copyFile(source.sourcePath, targetPath);
    existing.add(targetName);

    const kind = inferAttachmentKind(targetName) as AttachedFileKind;
    added.push({ name: targetName, kind });
  }

  return added;
}

export async function removeMaterialAttachment(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
): Promise<void> {
  const path = getMaterialAttachmentPath(library, materialId, filename);
  try {
    await library.fs.remove(path);
  } catch {
    throw new LibraryError(`Attachment not found: ${filename}`);
  }
}

export function attachmentKindLabel(kind: AttachedFileKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "png":
      return "PNG";
    case "jpg":
    case "jpeg":
      return "JPEG";
    case "tiff":
      return "TIFF";
    default:
      return "File";
  }
}
