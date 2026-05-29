import { z } from "zod";

export const APP_SETTINGS_VERSION = 1 as const;

export const appSettingsThemeSchema = z.enum(["system", "light", "dark"]);

export type AppSettingsTheme = z.infer<typeof appSettingsThemeSchema>;

export const recentLibraryEntryV1Schema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  lastOpenedAt: z.string().datetime(),
});

export type RecentLibraryEntryV1 = z.infer<typeof recentLibraryEntryV1Schema>;

export const appSettingsV1Schema = z.object({
  version: z.literal(APP_SETTINGS_VERSION),
  theme: appSettingsThemeSchema,
  recentLibraries: z.array(recentLibraryEntryV1Schema),
  checkForUpdates: z.boolean(),
});

export type AppSettingsV1 = z.infer<typeof appSettingsV1Schema>;

export const APP_SETTINGS_FILENAME = "settings.json";

export function createDefaultAppSettingsV1(): AppSettingsV1 {
  return {
    version: APP_SETTINGS_VERSION,
    theme: "system",
    recentLibraries: [],
    checkForUpdates: true,
  };
}
