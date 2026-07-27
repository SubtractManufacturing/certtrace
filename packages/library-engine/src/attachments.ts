import {
  type DirectoryEntry,
  inferAttachmentKind,
  isNotFoundError,
  uniqueAttachmentName,
} from "@certtrace/file-storage";
import type { AttachedFile, AttachedFileFormat } from "@certtrace/types";
import { joinPath } from "@certtrace/types";
import { LibraryError } from "./errors.js";
import type { OpenLibraryResult } from "./types.js";

const METADATA_FILENAME = "metadata.json";
const ATTACHMENTS_METADATA_FILENAME = ".attachments.json";

interface AttachmentsMetadata {
  version: 1;
  kinds: Record<string, string>;
}

function attachmentsMetadataPath(library: OpenLibraryResult, materialId: string): string {
  return joinPath(getMaterialFolderPath(library, materialId), ATTACHMENTS_METADATA_FILENAME);
}

async function readAttachmentsMetadata(
  library: OpenLibraryResult,
  materialId: string,
): Promise<AttachmentsMetadata> {
  let raw: string;
  try {
    raw = await library.fs.readFile(attachmentsMetadataPath(library, materialId));
  } catch (error) {
    if (isNotFoundError(error)) {
      return { version: 1, kinds: {} };
    }
    throw new LibraryError(
      `Unable to read attachment metadata for ${materialId}: ${String(error)}`,
    );
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AttachmentsMetadata>;
    if (parsed.version !== 1 || !parsed.kinds || typeof parsed.kinds !== "object") {
      throw new Error("invalid attachment metadata");
    }
    return { version: 1, kinds: parsed.kinds };
  } catch (error) {
    throw new LibraryError(`Invalid attachment metadata for ${materialId}: ${String(error)}`);
  }
}

async function writeAttachmentsMetadata(
  library: OpenLibraryResult,
  materialId: string,
  metadata: AttachmentsMetadata,
): Promise<void> {
  await library.fs.writeFile(
    attachmentsMetadataPath(library, materialId),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

function assertSafeAttachmentName(filename: string): void {
  if (
    !filename.trim() ||
    filename !== filename.trim() ||
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename === METADATA_FILENAME ||
    filename === ATTACHMENTS_METADATA_FILENAME
  ) {
    throw new LibraryError("Attachment name must be a filename without folder separators.");
  }
}

function assertAttachmentKindExists(library: OpenLibraryResult, kindKey: string): void {
  if (!library.fieldSchema.attachmentKinds.some((kind) => kind.key === kindKey)) {
    throw new LibraryError(`Unknown attachment kind: ${kindKey}`);
  }
}

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
  const metadata = await readAttachmentsMetadata(library, materialId);
  let entries: DirectoryEntry[];
  try {
    entries = await library.fs.readdir(folder);
  } catch {
    return [];
  }

  const attachments: AttachedFile[] = [];

  for (const entry of entries) {
    if (
      entry.isDirectory ||
      entry.name === METADATA_FILENAME ||
      entry.name === ATTACHMENTS_METADATA_FILENAME
    ) {
      continue;
    }

    const format = inferAttachmentKind(entry.name) as AttachedFileFormat;
    const configuredKindKey = metadata.kinds[entry.name];
    const kindKey = library.fieldSchema.attachmentKinds.some(
      (kind) => kind.key === configuredKindKey,
    )
      ? configuredKindKey
      : undefined;
    attachments.push({ name: entry.name, format, ...(kindKey ? { kindKey } : {}) });
  }

  return attachments.sort((left, right) => left.name.localeCompare(right.name));
}

export interface AttachFileSource {
  sourcePath: string;
  filename?: string;
  kindKey?: string;
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
  const metadata = await readAttachmentsMetadata(library, materialId);
  const added: AttachedFile[] = [];

  try {
    for (const source of sources) {
      const baseName = source.filename ?? source.sourcePath.split(/[/\\]/).pop() ?? "attachment";
      assertSafeAttachmentName(baseName);
      if (source.kindKey) {
        assertAttachmentKindExists(library, source.kindKey);
      }
      const targetName = uniqueAttachmentName(baseName, existing);
      const targetPath = getMaterialAttachmentPath(library, materialId, targetName);

      await library.fs.copyFile(source.sourcePath, targetPath);
      existing.add(targetName);

      if (source.kindKey) {
        metadata.kinds[targetName] = source.kindKey;
      }
      const format = inferAttachmentKind(targetName) as AttachedFileFormat;
      added.push({
        name: targetName,
        format,
        ...(source.kindKey ? { kindKey: source.kindKey } : {}),
      });
    }

    if (added.some((file) => file.kindKey)) {
      await writeAttachmentsMetadata(library, materialId, metadata);
    }
  } catch (error) {
    await Promise.allSettled(
      added.map((file) =>
        library.fs.remove(getMaterialAttachmentPath(library, materialId, file.name)),
      ),
    );
    throw error;
  }

  return added;
}

export async function renameMaterialAttachment(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
  nextFilename: string,
): Promise<AttachedFile> {
  assertSafeAttachmentName(filename);
  assertSafeAttachmentName(nextFilename);
  const attachments = await listMaterialAttachments(library, materialId);
  const current = attachments.find((attachment) => attachment.name === filename);
  if (!current) {
    throw new LibraryError(`Attachment not found: ${filename}`);
  }
  if (
    filename !== nextFilename &&
    attachments.some((attachment) => attachment.name === nextFilename)
  ) {
    throw new LibraryError(`Attachment already exists: ${nextFilename}`);
  }
  if (filename === nextFilename) {
    return current;
  }

  await library.fs.rename(
    getMaterialAttachmentPath(library, materialId, filename),
    getMaterialAttachmentPath(library, materialId, nextFilename),
  );
  const metadata = await readAttachmentsMetadata(library, materialId);
  const kindKey = metadata.kinds[filename];
  delete metadata.kinds[filename];
  if (kindKey) {
    metadata.kinds[nextFilename] = kindKey;
  }
  try {
    await writeAttachmentsMetadata(library, materialId, metadata);
  } catch (error) {
    await library.fs.rename(
      getMaterialAttachmentPath(library, materialId, nextFilename),
      getMaterialAttachmentPath(library, materialId, filename),
    );
    throw error;
  }

  return {
    name: nextFilename,
    format: inferAttachmentKind(nextFilename) as AttachedFileFormat,
    ...(kindKey ? { kindKey } : {}),
  };
}

export async function removeMaterialAttachment(
  library: OpenLibraryResult,
  materialId: string,
  filename: string,
): Promise<void> {
  assertSafeAttachmentName(filename);
  const attachments = await listMaterialAttachments(library, materialId);
  if (!attachments.some((attachment) => attachment.name === filename)) {
    throw new LibraryError(`Attachment not found: ${filename}`);
  }
  const metadata = await readAttachmentsMetadata(library, materialId);
  const kindKey = metadata.kinds[filename];
  if (kindKey) {
    delete metadata.kinds[filename];
    await writeAttachmentsMetadata(library, materialId, metadata);
  }
  const path = getMaterialAttachmentPath(library, materialId, filename);
  try {
    await library.fs.remove(path);
  } catch {
    if (kindKey) {
      metadata.kinds[filename] = kindKey;
      await writeAttachmentsMetadata(library, materialId, metadata);
    }
    throw new LibraryError(`Attachment not found: ${filename}`);
  }
}

export async function clearAttachmentKindAssignments(
  library: OpenLibraryResult,
  kindKeys: ReadonlySet<string>,
): Promise<() => Promise<void>> {
  if (kindKeys.size === 0) {
    return async () => undefined;
  }
  const entries = await library.fs.readdir(library.paths.materials);
  const changes: Array<{
    materialId: string;
    previous: AttachmentsMetadata;
    next: AttachmentsMetadata;
  }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory) {
      continue;
    }
    const metadata = await readAttachmentsMetadata(library, entry.name);
    const nextKinds = Object.fromEntries(
      Object.entries(metadata.kinds).filter(([, kindKey]) => !kindKeys.has(kindKey)),
    );
    if (Object.keys(nextKinds).length !== Object.keys(metadata.kinds).length) {
      changes.push({
        materialId: entry.name,
        previous: metadata,
        next: { version: 1, kinds: nextKinds },
      });
    }
  }

  const written: typeof changes = [];
  try {
    for (const change of changes) {
      await writeAttachmentsMetadata(library, change.materialId, change.next);
      written.push(change);
    }
  } catch (error) {
    await Promise.allSettled(
      written.map((change) =>
        writeAttachmentsMetadata(library, change.materialId, change.previous),
      ),
    );
    throw error;
  }

  return async () => {
    await Promise.all(
      changes.map((change) =>
        writeAttachmentsMetadata(library, change.materialId, change.previous),
      ),
    );
  };
}

export function attachmentFormatLabel(format: AttachedFileFormat): string {
  switch (format) {
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
