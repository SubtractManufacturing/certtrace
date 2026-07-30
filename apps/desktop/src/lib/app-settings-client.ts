import {
  readAppSettings,
  removeLibraryFromAppSettings,
  touchRecentLibrary,
  writeAppSettings,
} from "@certtrace/core";
import type { AppSettingsV1 } from "@certtrace/types";
import { appDataDir } from "@tauri-apps/api/path";
import { createTauriFileSystem } from "./tauri-fs";

const fs = createTauriFileSystem();

async function getSettingsDir(): Promise<string> {
  return appDataDir();
}

export async function loadAppSettings(): Promise<AppSettingsV1> {
  return readAppSettings(fs, await getSettingsDir());
}

export async function saveAppSettings(settings: AppSettingsV1): Promise<void> {
  await writeAppSettings(fs, await getSettingsDir(), settings);
}

export async function recordRecentLibrary(path: string, name: string): Promise<AppSettingsV1> {
  const settings = touchRecentLibrary(await loadAppSettings(), { path, name });
  await saveAppSettings(settings);
  return settings;
}

export async function forgetRecentLibrary(path: string): Promise<AppSettingsV1> {
  const settings = removeLibraryFromAppSettings(await loadAppSettings(), path);
  await saveAppSettings(settings);
  return settings;
}
