import { openLibrary } from "@certtrace/library-engine";
import {
  FIELD_SCHEMA_JSON,
  LIBRARY_BACKUP_SKIP_NAMES,
  LIBRARY_BACKUP_SKIP_PREFIXES,
  LIBRARY_JSON,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
} from "@certtrace/types";
import { open, save } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listZipEntries,
  readZipEntryText,
  unzipLibraryDir,
  zipLibraryDir,
} from "./library-archive-client";
import {
  backupLibraryAtPath,
  inspectLibraryBackup,
  pickLibraryBackupSavePath,
  pickLibraryBackupZip,
  restoreLibraryFromBackup,
} from "./library-client";
import { allowLibraryDirectory } from "./library-scope";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@certtrace/library-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@certtrace/library-engine")>();
  return {
    ...actual,
    openLibrary: vi.fn(),
  };
});

vi.mock("@tauri-apps/plugin-fs", () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("./app-settings-client", () => ({
  recordRecentLibrary: vi.fn(),
}));

vi.mock("./library-scope", () => ({
  allowLibraryDirectory: vi.fn(),
}));

vi.mock("./library-archive-client", () => ({
  listZipEntries: vi.fn(),
  readZipEntryText: vi.fn(),
  zipLibraryDir: vi.fn(),
  unzipLibraryDir: vi.fn(),
  cancelLibraryArchive: vi.fn(),
}));

const REQUIRED = [LIBRARY_JSON, NAMING_RULES_JSON, WORD_LISTS_JSON, FIELD_SCHEMA_JSON];

describe("library backup and restore client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(allowLibraryDirectory).mockResolvedValue(undefined);
  });

  it("picks a ZIP file and a suggested backup save path", async () => {
    vi.mocked(open).mockResolvedValue("/backups/shop.zip");
    await expect(pickLibraryBackupZip()).resolves.toBe("/backups/shop.zip");
    expect(open).toHaveBeenCalledWith({
      title: "Choose a library backup",
      multiple: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });

    vi.mocked(save).mockResolvedValue("/backups/Main Shop backup 2026-08-19.zip");
    await expect(pickLibraryBackupSavePath("/libraries/Main Shop")).resolves.toBe(
      "/backups/Main Shop backup 2026-08-19.zip",
    );
    expect(save).toHaveBeenCalledWith({
      title: "Save library backup",
      defaultPath: expect.stringMatching(/^Main Shop backup \d{4}-\d{2}-\d{2}\.zip$/),
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
  });

  it("inspects a wrapping-folder ZIP and reads the library name", async () => {
    vi.mocked(listZipEntries).mockResolvedValue(REQUIRED.map((file) => `Shop Materials/${file}`));
    vi.mocked(readZipEntryText).mockResolvedValue('{"name":"Shop Materials","version":4}');

    await expect(inspectLibraryBackup("/backups/shop.zip")).resolves.toEqual({
      name: "Shop Materials",
      prefix: "Shop Materials",
    });
    expect(readZipEntryText).toHaveBeenCalledWith(
      "/backups/shop.zip",
      "Shop Materials/.certtrace/library.json",
    );
  });

  it("rejects a ZIP that is not a CertTrace library without creating a folder", async () => {
    vi.mocked(listZipEntries).mockResolvedValue(["notes.txt"]);

    await expect(inspectLibraryBackup("/backups/notes.zip")).rejects.toThrow(
      "This ZIP is not a CertTrace library.",
    );
    expect(unzipLibraryDir).not.toHaveBeenCalled();
  });

  it("zips a library at the chosen path with backup skip rules", async () => {
    await backupLibraryAtPath("/libraries/Main Shop", "/backups/shop.zip");

    expect(zipLibraryDir).toHaveBeenCalledWith(
      "/libraries/Main Shop",
      "/backups/shop.zip",
      [...LIBRARY_BACKUP_SKIP_PREFIXES],
      [...LIBRARY_BACKUP_SKIP_NAMES],
    );
    expect(allowLibraryDirectory).toHaveBeenCalledWith("/backups", { recursive: false });
  });

  it("grants access to filesystem root when saving a backup there", async () => {
    await backupLibraryAtPath("/libraries/Main Shop", "/shop.zip");

    expect(allowLibraryDirectory).toHaveBeenCalledWith("/", { recursive: false });
  });

  it("deletes the dest folder when unzip or open fails", async () => {
    const { remove } = await import("@tauri-apps/plugin-fs");
    vi.mocked(listZipEntries).mockResolvedValue([...REQUIRED]);
    vi.mocked(readZipEntryText).mockResolvedValue('{"name":"Main Shop","version":4}');
    vi.mocked(unzipLibraryDir).mockRejectedValueOnce(new Error("disk full"));

    await expect(restoreLibraryFromBackup("/backups/shop.zip", "/libraries")).rejects.toThrow(
      "disk full",
    );
    expect(remove).toHaveBeenCalledWith("/libraries/Main Shop", {
      recursive: true,
    });
    expect(openLibrary).not.toHaveBeenCalled();

    vi.mocked(unzipLibraryDir).mockResolvedValue(undefined);
    vi.mocked(openLibrary).mockRejectedValueOnce(new Error("Library is too new"));

    await expect(restoreLibraryFromBackup("/backups/shop.zip", "/libraries")).rejects.toThrow(
      "Library is too new",
    );
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("opens a restored library when unzip succeeds", async () => {
    const library = {
      paths: { root: "/libraries/Main Shop" },
      config: { name: "Main Shop" },
    } as never;
    vi.mocked(listZipEntries).mockResolvedValue([...REQUIRED]);
    vi.mocked(readZipEntryText).mockResolvedValue('{"name":"Main Shop","version":4}');
    vi.mocked(unzipLibraryDir).mockResolvedValue(undefined);
    vi.mocked(openLibrary).mockResolvedValue(library);

    await expect(restoreLibraryFromBackup("/backups/shop.zip", "/libraries")).resolves.toBe(
      library,
    );
    expect(unzipLibraryDir).toHaveBeenCalledWith("/backups/shop.zip", "/libraries/Main Shop", "");
    expect(openLibrary).toHaveBeenCalled();
  });
});
