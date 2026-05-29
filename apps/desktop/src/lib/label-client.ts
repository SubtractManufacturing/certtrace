import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { generateStandardQrLabelPdf, type StandardQrLabelOptions } from "@certtrace/core";
import type { MaterialMetadataV1 } from "@certtrace/types";

export async function generateStandardQrLabelPdfBytes(
  material: MaterialMetadataV1,
  options?: StandardQrLabelOptions,
): Promise<Uint8Array> {
  return generateStandardQrLabelPdf(material, options);
}

export async function saveLabelPdfViaDialog(
  material: MaterialMetadataV1,
  options?: StandardQrLabelOptions,
): Promise<string | null> {
  const bytes = await generateStandardQrLabelPdf(material, options);
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
  await openPath(path);
}
