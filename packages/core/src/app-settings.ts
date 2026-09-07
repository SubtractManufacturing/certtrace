import { type FileSystem, isNotFoundError } from "@certtrace/file-storage";
import {
  APP_SETTINGS_FILENAME,
  type AppSettingsV1,
  appSettingsV1Schema,
  createDefaultAppSettingsV1,
  type RegisteredPrinterV1,
} from "@certtrace/types";

export class AppSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppSettingsError";
  }
}

export { APP_SETTINGS_FILENAME };

function normalizedPrinterValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function addRegisteredPrinter(
  settings: AppSettingsV1,
  printer: RegisteredPrinterV1,
): AppSettingsV1 {
  const validated = {
    ...printer,
    name: printer.name.trim(),
  };
  if (
    settings.printers.some(
      (entry) => normalizedPrinterValue(entry.name) === normalizedPrinterValue(validated.name),
    )
  ) {
    throw new AppSettingsError(`Printer name is already registered: ${validated.name}`);
  }
  if (
    settings.printers.some(
      (entry) =>
        normalizedPrinterValue(entry.queueName) === normalizedPrinterValue(validated.queueName),
    )
  ) {
    throw new AppSettingsError(`OS queue is already registered: ${validated.queueName}`);
  }
  return appSettingsV1Schema.parse({
    ...settings,
    printers: [...settings.printers, validated],
  });
}

export function updateRegisteredPrinter(
  settings: AppSettingsV1,
  printer: RegisteredPrinterV1,
): AppSettingsV1 {
  if (!settings.printers.some((entry) => entry.id === printer.id)) {
    throw new AppSettingsError(`Printer is not registered: ${printer.id}`);
  }
  const withoutPrinter = {
    ...settings,
    printers: settings.printers.filter((entry) => entry.id !== printer.id),
  };
  const validated = addRegisteredPrinter(withoutPrinter, printer).printers.at(-1)!;
  return {
    ...settings,
    printers: settings.printers.map((entry) => (entry.id === printer.id ? validated : entry)),
  };
}

export function assignLabelTemplatePrinter(
  settings: AppSettingsV1,
  libraryPath: string,
  labelTemplateId: string,
  printerId: string | null,
): AppSettingsV1 {
  if (printerId && !settings.printers.some((entry) => entry.id === printerId)) {
    throw new AppSettingsError(`Printer is not registered: ${printerId}`);
  }
  const otherAssignments = settings.labelTemplatePrinters.filter(
    (entry) => entry.libraryPath !== libraryPath || entry.labelTemplateId !== labelTemplateId,
  );
  return {
    ...settings,
    labelTemplatePrinters: printerId
      ? [...otherAssignments, { libraryPath, labelTemplateId, printerId }]
      : otherAssignments,
  };
}

export function deleteRegisteredPrinter(settings: AppSettingsV1, printerId: string): AppSettingsV1 {
  return {
    ...settings,
    printers: settings.printers.filter((entry) => entry.id !== printerId),
    labelTemplatePrinters: settings.labelTemplatePrinters.filter(
      (entry) => entry.printerId !== printerId,
    ),
  };
}

export async function readAppSettings(fs: FileSystem, settingsDir: string): Promise<AppSettingsV1> {
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

export function removeLibraryFromAppSettings(settings: AppSettingsV1, path: string): AppSettingsV1 {
  const next = removeRecentLibrary(settings, path);

  return {
    ...next,
    defaultLibraryOnLaunch:
      next.defaultLibraryOnLaunch === path ? null : next.defaultLibraryOnLaunch,
    labelTemplatePrinters: next.labelTemplatePrinters.filter((entry) => entry.libraryPath !== path),
  };
}
