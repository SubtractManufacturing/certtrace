import { invoke } from "@tauri-apps/api/core";

export async function allowLibraryDirectory(path: string): Promise<void> {
  await invoke("allow_library_directory", { path });
}
