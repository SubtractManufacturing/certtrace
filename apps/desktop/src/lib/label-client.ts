import { generateLabelPdf } from "@certtrace/core";
import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { LabelTemplate, MaterialMetadataV1 } from "@certtrace/types";
import { invoke } from "@tauri-apps/api/core";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";

export function getDefaultLabelTemplate(library: OpenLibraryResult): LabelTemplate {
  const template = library.config.labelTemplates.find(
    (entry) => entry.id === library.config.defaultLabelTemplateId,
  );
  if (!template) {
    throw new Error("Library default Label Template is missing.");
  }
  return template;
}

export async function generateLibraryLabelPdfBytes(
  library: OpenLibraryResult,
  materials: MaterialMetadataV1[],
  template: LabelTemplate = getDefaultLabelTemplate(library),
): Promise<Uint8Array> {
  const { pdf } = await generateLabelPdf({
    template,
    materials,
    fieldSchema: library.fieldSchema,
  });
  return pdf;
}

export async function saveLabelPdfViaDialog(
  library: OpenLibraryResult,
  material: MaterialMetadataV1,
): Promise<string | null> {
  const bytes = await generateLibraryLabelPdfBytes(library, [material]);
  const path = await save({
    title: "Save label PDF",
    defaultPath: `${material.id}-label.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!path) {
    return null;
  }

  await writeFile(path, bytes);
  return path;
}

export async function openPathWithOpener(path: string): Promise<void> {
  if (/^https?:\/\//i.test(path)) {
    await openUrl(path);
    return;
  }

  await invoke("open_local_path", { path });
}

async function writeLabelPdfToCache(bytes: Uint8Array, materialId: string): Promise<string> {
  const cacheDir = await join(await appCacheDir(), "print-labels");
  await mkdir(cacheDir, { recursive: true });
  const path = await join(cacheDir, `${materialId}-label.pdf`);
  await writeFile(path, bytes);
  return path;
}

export async function printLabelPdf(bytes: Uint8Array, materialId: string): Promise<void> {
  const path = await writeLabelPdfToCache(bytes, materialId);
  await invoke("print_pdf_file", { path });
}

export async function printLabelPdfFromObjectUrl(
  objectUrl: string,
  materialId: string,
): Promise<void> {
  const response = await fetch(objectUrl);
  if (!response.ok) {
    throw new Error(`Failed to read label data (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await printLabelPdf(bytes, materialId);
}
