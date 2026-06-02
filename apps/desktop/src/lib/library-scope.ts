import { invoke } from "@tauri-apps/api/core";

interface AllowLibraryDirectoryOptions {
  recursive?: boolean;
}

export async function allowLibraryDirectory(
  path: string,
  { recursive = true }: AllowLibraryDirectoryOptions = {},
): Promise<void> {
  await invoke("allow_library_directory", { path, recursive });
}
