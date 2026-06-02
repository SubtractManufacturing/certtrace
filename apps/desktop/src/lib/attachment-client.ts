import { open } from "@tauri-apps/plugin-dialog";
import { attachFiles, type OpenLibraryResult } from "@certtrace/library-engine";
import type { AttachedFile } from "@certtrace/types";

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
): Promise<AttachedFile[]> {
  if (sourcePaths.length === 0) {
    return [];
  }

  return attachFiles(
    library,
    materialId,
    sourcePaths.map((sourcePath) => ({ sourcePath })),
  );
}
