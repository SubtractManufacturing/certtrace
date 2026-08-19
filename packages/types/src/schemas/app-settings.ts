import { z } from "zod";
import { sizeUnitSchema } from "../size.js";

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
  defaultLibraryOnLaunch: z
    .union([z.string().min(1), z.literal("all")])
    .nullable()
    .default(null),
  /** When false (default), search excludes Archived Materials. */
  includeArchivedMaterialsInSearch: z.boolean().default(false),
  /** Default unit for new Size entry and measurement UIs (shipped inch). */
  defaultUnit: sizeUnitSchema.default("in"),
});

export type AppSettingsV1 = z.infer<typeof appSettingsV1Schema>;
export type DefaultLibraryOnLaunch = AppSettingsV1["defaultLibraryOnLaunch"];

export const APP_SETTINGS_FILENAME = "settings.json";

export function createDefaultAppSettingsV1(): AppSettingsV1 {
  return {
    version: APP_SETTINGS_VERSION,
    theme: "system",
    recentLibraries: [],
    checkForUpdates: true,
    defaultLibraryOnLaunch: null,
    includeArchivedMaterialsInSearch: false,
    defaultUnit: "in",
  };
}
