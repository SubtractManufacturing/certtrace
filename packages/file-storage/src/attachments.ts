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
