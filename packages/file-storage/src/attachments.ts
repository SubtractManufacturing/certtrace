export type AttachmentKind = "pdf" | "png" | "jpg" | "jpeg" | "tiff" | "other";

const EXTENSION_KIND: Record<string, AttachmentKind> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpg",
  jpeg: "jpeg",
  tiff: "tiff",
  tif: "tiff",
};

export function inferAttachmentKind(filename: string): AttachmentKind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_KIND[ext] ?? "other";
}

// Shell metacharacters, characters Windows forbids in filenames, control characters, and
// bidirectional overrides (which can disguise a file's real extension).
const UNSAFE_NAME_CHARACTERS = /[&|<>^%!"`$;:*?\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]+/gu;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i;

/**
 * Replace characters that are unsafe in a stored attachment filename. Path separators are left
 * alone so callers can reject them.
 */
export function sanitizeAttachmentName(filename: string): string {
  return filename
    .replace(UNSAFE_NAME_CHARACTERS, "_")
    .trim()
    .replace(/[. ]+$/, "")
    .replace(WINDOWS_DEVICE_NAME, "_$&");
}

export function uniqueAttachmentName(filename: string, existing: ReadonlySet<string>): string {
  if (!existing.has(filename)) {
    return filename;
  }

  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}${ext}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}${ext}`;
}
