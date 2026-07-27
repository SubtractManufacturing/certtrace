/** On-disk layout for a CertTrace material library. */
export const CERTTRACE_DIR = ".certtrace";
export const MATERIALS_DIR = "materials";
export const LABELS_DIR = `${CERTTRACE_DIR}/labels`;
export const BACKUPS_DIR = `${CERTTRACE_DIR}/backups`;

export const LIBRARY_JSON = `${CERTTRACE_DIR}/library.json`;
export const NAMING_RULES_JSON = `${CERTTRACE_DIR}/naming-rules.json`;
export const WORD_LISTS_JSON = `${CERTTRACE_DIR}/word-lists.json`;
export const FIELD_SCHEMA_JSON = `${CERTTRACE_DIR}/field-schema.json`;

export const LIBRARY_README = "README.md";

export const materialDir = (materialId: string) => `${MATERIALS_DIR}/${materialId}`;
export const materialMetadataPath = (materialId: string) =>
  `${materialDir(materialId)}/metadata.json`;

/** Join path segments for library layout (browser + Node safe). */
export function joinPath(base: string, ...parts: string[]): string {
  const separator = base.includes("\\") ? "\\" : "/";
  let result = base.replace(/[/\\]+$/, "");

  for (const part of parts) {
    const cleaned = part.replace(/^[/\\]+|[/\\]+$/g, "");
    if (cleaned) {
      result += `${separator}${cleaned}`;
    }
  }

  return result;
}

/** Folder name for a new library (same as display name, minus invalid path characters). */
export function libraryFolderName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("Library name cannot be empty");
  }

  const sanitized = trimmed
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[.\s]+$/g, "")
    .trim();

  if (!sanitized) {
    throw new Error("Library name cannot be empty");
  }

  return sanitized;
}

/** Filesystem-safe material IDs (folder names). */
export const MATERIAL_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export const LIBRARY_PATHS = [
  LIBRARY_JSON,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
  FIELD_SCHEMA_JSON,
  LABELS_DIR,
  MATERIALS_DIR,
] as const;
