import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LibraryArchiveProgress {
  current: number;
  total: number;
  relativePath: string;
}

export async function listZipEntries(zipPath: string): Promise<string[]> {
  return invoke("list_zip_entries", { zipPath });
}

export async function readZipEntryText(zipPath: string, entry: string): Promise<string> {
  return invoke("read_zip_entry_text", { zipPath, entry });
}

export async function zipLibraryDir(
  root: string,
  dest: string,
  skipPrefixes: readonly string[],
  skipNames: readonly string[],
): Promise<void> {
  await invoke("zip_library_dir", { root, dest, skipPrefixes, skipNames });
}

export async function unzipLibraryDir(
  zipPath: string,
  dest: string,
  stripPrefix: string,
): Promise<void> {
  await invoke("unzip_library_dir", { zipPath, dest, stripPrefix });
}

export async function cancelLibraryArchive(): Promise<void> {
  await invoke("cancel_library_archive");
}

export async function onLibraryArchiveProgress(
  handler: (progress: LibraryArchiveProgress) => void,
): Promise<UnlistenFn> {
  return listen<LibraryArchiveProgress>("library-archive-progress", (event) => {
    handler(event.payload);
  });
}
