/** On-disk layout for a CertTrace material library. */
export const CERTTRACE_DIR = ".certtrace";
export const MATERIALS_DIR = "materials";
export const LABELS_DIR = `${CERTTRACE_DIR}/labels`;
export const BACKUPS_DIR = `${CERTTRACE_DIR}/backups`;

export const LIBRARY_JSON = `${CERTTRACE_DIR}/library.json`;
export const NAMING_RULES_JSON = `${CERTTRACE_DIR}/naming-rules.json`;
export const WORD_LISTS_JSON = `${CERTTRACE_DIR}/word-lists.json`;

export const materialDir = (materialId: string) => `${MATERIALS_DIR}/${materialId}`;
export const materialMetadataPath = (materialId: string) =>
  `${materialDir(materialId)}/metadata.json`;

/** Filesystem-safe material IDs (folder names). */
export const MATERIAL_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export const LIBRARY_PATHS = [
  LIBRARY_JSON,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
  LABELS_DIR,
  MATERIALS_DIR,
] as const;
