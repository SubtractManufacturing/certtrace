import { isNotFoundError, type FileSystem } from "@certtrace/file-storage";
import {
  APP_SETTINGS_FILENAME,
  appSettingsV1Schema,
  createDefaultAppSettingsV1,
  type AppSettingsV1,
} from "@certtrace/types";

export class AppSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppSettingsError";
  }
}

export { APP_SETTINGS_FILENAME };

export async function readAppSettings(
  fs: FileSystem,
  settingsDir: string,
): Promise<AppSettingsV1> {
  const settingsPath = `${settingsDir}/${APP_SETTINGS_FILENAME}`;

  try {
    await fs.mkdir(settingsDir, { recursive: true });
    const raw = await fs.readFile(settingsPath);
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppSettingsError(`Invalid JSON in app settings at ${settingsPath}`);
    }

    return appSettingsV1Schema.parse(parsed);
  } catch (error) {
    if (error instanceof AppSettingsError) {
      throw error;
    }

    if (isNotFoundError(error)) {
      return createDefaultAppSettingsV1();
    }

    throw error;
  }
}

export async function writeAppSettings(
  fs: FileSystem,
  settingsDir: string,
  settings: AppSettingsV1,
): Promise<void> {
  const validated = appSettingsV1Schema.parse(settings);
  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(
    `${settingsDir}/${APP_SETTINGS_FILENAME}`,
    `${JSON.stringify(validated, null, 2)}\n`,
  );
}

export function touchRecentLibrary(
  settings: AppSettingsV1,
  entry: { path: string; name: string },
  openedAt = new Date(),
): AppSettingsV1 {
  const filtered = settings.recentLibraries.filter((item) => item.path !== entry.path);
  const nextEntry = {
    path: entry.path,
    name: entry.name,
    lastOpenedAt: openedAt.toISOString(),
  };

  return {
    ...settings,
    recentLibraries: [nextEntry, ...filtered].slice(0, 10),
  };
}

export function removeRecentLibrary(settings: AppSettingsV1, path: string): AppSettingsV1 {
  return {
    ...settings,
    recentLibraries: settings.recentLibraries.filter((item) => item.path !== path),
  };
}
