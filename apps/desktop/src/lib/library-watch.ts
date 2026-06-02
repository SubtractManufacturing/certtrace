import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LibraryWatchEvent {
  kind: string;
  root: string;
  paths: string[];
}

export async function syncLibraryWatch(roots: string[]): Promise<void> {
  await invoke("sync_library_watch", { roots });
}

export async function startLibraryWatch(root: string): Promise<void> {
  await invoke("start_library_watch", { root });
}

export async function stopLibraryWatch(): Promise<void> {
  await invoke("stop_library_watch");
}

export async function onLibraryFsChanged(
  handler: (event: LibraryWatchEvent) => void,
): Promise<UnlistenFn> {
  return listen<LibraryWatchEvent>("library-fs-changed", (event) => {
    handler(event.payload);
  });
}
