import type { FileSystem } from "@certtrace/file-storage";
import { isNotFoundError } from "@certtrace/file-storage";
import {
  joinPath,
  LIBRARY_BACKUP_REQUIRED_FILES,
  LIBRARY_BACKUP_SKIP_NAMES,
  LIBRARY_BACKUP_SKIP_PREFIXES,
  libraryFolderName,
} from "@certtrace/types";
import { LibraryError } from "./errors.js";

const ZIP_NOT_A_LIBRARY = "This ZIP is not a CertTrace library.";
const ZIP_MULTIPLE_LIBRARIES = "This ZIP contains more than one CertTrace library.";

/** Normalize ZIP entry paths to `/` separators without a leading `./`. */
export function normalizeZipPath(entryPath: string): string {
  return entryPath
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");
}

export function shouldIncludeInLibraryBackup(relativePath: string): boolean {
  const normalized = normalizeZipPath(relativePath);
  if (!normalized) {
    return false;
  }

  for (const prefix of LIBRARY_BACKUP_SKIP_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return false;
    }
  }

  const baseName = normalized.split("/").pop() ?? normalized;
  return !(LIBRARY_BACKUP_SKIP_NAMES as readonly string[]).includes(baseName);
}

function prefixesForRequiredFile(entryPaths: string[], required: string): string[] {
  const prefixes: string[] = [];
  for (const entryPath of entryPaths) {
    const normalized = normalizeZipPath(entryPath);
    if (!normalized) {
      continue;
    }
    if (normalized === required) {
      prefixes.push("");
      continue;
    }
    const suffix = `/${required}`;
    if (normalized.endsWith(suffix)) {
      prefixes.push(normalized.slice(0, normalized.length - suffix.length));
    }
  }
  return prefixes;
}

/** Shared ZIP prefix of the four required config files (`""` or one wrapping folder). */
export function findLibraryRootPrefix(entryPaths: string[]): string {
  const prefixSets = LIBRARY_BACKUP_REQUIRED_FILES.map((required) =>
    prefixesForRequiredFile(entryPaths, required),
  );

  for (const prefixes of prefixSets) {
    if (prefixes.length > 1) {
      throw new LibraryError(ZIP_MULTIPLE_LIBRARIES);
    }
    if (prefixes.length === 0) {
      throw new LibraryError(ZIP_NOT_A_LIBRARY);
    }
  }

  const prefixes = prefixSets.map((set) => set[0]);
  const first = prefixes[0];
  if (first === undefined) {
    throw new LibraryError(ZIP_NOT_A_LIBRARY);
  }
  if (prefixes.some((prefix) => prefix !== first)) {
    throw new LibraryError(ZIP_NOT_A_LIBRARY);
  }

  if (first.includes("/")) {
    throw new LibraryError(ZIP_NOT_A_LIBRARY);
  }

  return first;
}

export function libraryBackupSuggestedFileName(folderName: string, date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${folderName} backup ${year}-${month}-${day}.zip`;
}

export function libraryRestoreDestination(parentDir: string, libraryName: string): string {
  return joinPath(parentDir, libraryFolderName(libraryName));
}

export function parseLibraryNameFromConfigJson(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LibraryError(ZIP_NOT_A_LIBRARY);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("name" in parsed) ||
    typeof parsed.name !== "string" ||
    parsed.name.trim().length === 0
  ) {
    throw new LibraryError(ZIP_NOT_A_LIBRARY);
  }

  return parsed.name.trim();
}

function splitDestPath(dest: string): { parent: string; name: string } {
  const trimmed = dest.replace(/[/\\]+$/, "");
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (separatorIndex <= 0) {
    return { parent: trimmed, name: trimmed };
  }
  return {
    parent: trimmed.slice(0, separatorIndex),
    name: trimmed.slice(separatorIndex + 1),
  };
}

/** Restore dest must not exist at all — stricter than create-library occupancy. */
export async function assertRestoreDestinationFree(fs: FileSystem, dest: string): Promise<void> {
  const { parent, name } = splitDestPath(dest);
  try {
    const entries = await fs.readdir(parent);
    if (entries.some((entry) => entry.name === name)) {
      throw new LibraryError(`A folder already exists at ${dest}`);
    }
  } catch (error: unknown) {
    if (error instanceof LibraryError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return;
    }
    throw new LibraryError(`Unable to inspect restore destination at ${dest}: ${String(error)}`);
  }
}
