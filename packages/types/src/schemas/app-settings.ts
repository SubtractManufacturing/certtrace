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

export const registeredPrinterV1Schema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  queueName: z.string().min(1),
});

export type RegisteredPrinterV1 = z.infer<typeof registeredPrinterV1Schema>;

export const labelTemplatePrinterV1Schema = z.object({
  libraryPath: z.string().min(1),
  labelTemplateId: z.string().min(1),
  printerId: z.string().min(1),
});

export type LabelTemplatePrinterV1 = z.infer<typeof labelTemplatePrinterV1Schema>;

export const appSettingsV1Schema = z
  .object({
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
    /** Shop-named destinations registered on this computer. */
    printers: z.array(registeredPrinterV1Schema).default([]),
    /** Per-computer Label Template destinations, keyed by Library path and template id. */
    labelTemplatePrinters: z.array(labelTemplatePrinterV1Schema).default([]),
  })
  .superRefine((settings, context) => {
    const printerIds = new Set<string>();
    const printerNames = new Set<string>();
    const queueNames = new Set<string>();

    for (const [index, printer] of settings.printers.entries()) {
      const name = printer.name.trim().toLocaleLowerCase();
      const queueName = printer.queueName.trim().toLocaleLowerCase();
      for (const [values, value, field, message] of [
        [printerIds, printer.id, "id", "Printer ids must be unique"],
        [printerNames, name, "name", "Printer names must be unique"],
        [queueNames, queueName, "queueName", "OS queues may only be registered once"],
      ] as const) {
        if (values.has(value)) {
          context.addIssue({
            code: "custom",
            message,
            path: ["printers", index, field],
          });
        }
        values.add(value);
      }
    }

    const assignmentKeys = new Set<string>();
    for (const [index, assignment] of settings.labelTemplatePrinters.entries()) {
      const key = JSON.stringify([assignment.libraryPath, assignment.labelTemplateId]);
      if (assignmentKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: "A Label Template may have only one Printer",
          path: ["labelTemplatePrinters", index],
        });
      }
      assignmentKeys.add(key);
      if (!printerIds.has(assignment.printerId)) {
        context.addIssue({
          code: "custom",
          message: "Label Template Printer must reference a registered Printer",
          path: ["labelTemplatePrinters", index, "printerId"],
        });
      }
    }
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
    printers: [],
    labelTemplatePrinters: [],
  };
}
