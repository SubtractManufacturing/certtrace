import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { mkdir } from "@tauri-apps/plugin-fs";

export async function openAppDataFolder(): Promise<void> {
  const dir = await appDataDir();
  await mkdir(dir, { recursive: true });
  await invoke("open_local_path", { path: dir });
}
