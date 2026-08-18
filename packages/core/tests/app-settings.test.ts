import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@certtrace/file-storage";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { createDefaultAppSettingsV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  readAppSettings,
  removeLibraryFromAppSettings,
  removeRecentLibrary,
  touchRecentLibrary,
  writeAppSettings,
} from "../src/app-settings.js";

const WINDOWS_SETTINGS_READ_ERROR =
  "failed to open file at path: C:\\Users\\test\\AppData\\Roaming\\com.subtractmanufacturing.certtrace/settings.json with error: The system cannot find the file specified. (os error 2)";

describe("app settings", () => {
  it("returns defaults when settings file is missing", async () => {
    const fs = createNodeFileSystem();
    const settingsDir = await mkdtemp(join(tmpdir(), "certtrace-settings-"));

    try {
      const settings = await readAppSettings(fs, settingsDir);
      expect(settings).toEqual(createDefaultAppSettingsV1());
      expect(settings.includeArchivedMaterialsInSearch).toBe(false);
      expect(settings.defaultUnit).toBe("in");
    } finally {
      await rm(settingsDir, { recursive: true, force: true });
    }
  });

  it("defaults includeArchivedMaterialsInSearch to false for legacy settings files", async () => {
    const fs = createNodeFileSystem();
    const settingsDir = await mkdtemp(join(tmpdir(), "certtrace-settings-"));

    try {
      await writeAppSettings(fs, settingsDir, {
        version: 1,
        theme: "system",
        recentLibraries: [],
        checkForUpdates: true,
        defaultLibraryOnLaunch: null,
        includeArchivedMaterialsInSearch: false,
      });
      // Simulate a pre-setting file written without the new key.
      await fs.writeFile(
        `${settingsDir}/settings.json`,
        `${JSON.stringify(
          {
            version: 1,
            theme: "system",
            recentLibraries: [],
            checkForUpdates: true,
            defaultLibraryOnLaunch: null,
          },
          null,
          2,
        )}\n`,
      );

      const settings = await readAppSettings(fs, settingsDir);
      expect(settings.includeArchivedMaterialsInSearch).toBe(false);
    } finally {
      await rm(settingsDir, { recursive: true, force: true });
    }
  });

  it("defaults defaultUnit to inch for legacy settings files", async () => {
    const fs = createNodeFileSystem();
    const settingsDir = await mkdtemp(join(tmpdir(), "certtrace-settings-"));

    try {
      await fs.writeFile(
        `${settingsDir}/settings.json`,
        `${JSON.stringify(
          {
            version: 1,
            theme: "system",
            recentLibraries: [],
            checkForUpdates: true,
            defaultLibraryOnLaunch: null,
            includeArchivedMaterialsInSearch: false,
          },
          null,
          2,
        )}\n`,
      );

      const settings = await readAppSettings(fs, settingsDir);
      expect(settings.defaultUnit).toBe("in");
    } finally {
      await rm(settingsDir, { recursive: true, force: true });
    }
  });

  it("returns defaults when read throws a Windows Tauri missing-path string", async () => {
    const fs: FileSystem = {
      mkdir: async () => undefined,
      readFile: async () => {
        throw WINDOWS_SETTINGS_READ_ERROR;
      },
      writeFile: async () => undefined,
      readBinary: async () => new Uint8Array(),
      writeBinary: async () => undefined,
      remove: async () => undefined,
      copyFile: async () => undefined,
      readdir: async () => [],
    };

    await expect(
      readAppSettings(fs, "C:\\Users\\test\\AppData\\Roaming\\com.subtractmanufacturing.certtrace"),
    ).resolves.toEqual(createDefaultAppSettingsV1());
  });

  it("ensures the settings directory exists before reading settings", async () => {
    const calls: string[] = [];
    const defaults = createDefaultAppSettingsV1();
    const fs: FileSystem = {
      mkdir: async () => {
        calls.push("mkdir");
      },
      readFile: async () => {
        calls.push("readFile");
        return JSON.stringify(defaults);
      },
      writeFile: async () => undefined,
      readBinary: async () => new Uint8Array(),
      writeBinary: async () => undefined,
      remove: async () => undefined,
      copyFile: async () => undefined,
      readdir: async () => [],
    };

    await expect(readAppSettings(fs, "/tmp/certtrace-settings")).resolves.toEqual(defaults);
    expect(calls).toEqual(["mkdir", "readFile"]);
  });

  it("round-trips settings to disk", async () => {
    const fs = createNodeFileSystem();
    const settingsDir = await mkdtemp(join(tmpdir(), "certtrace-settings-"));

    try {
      const initial = touchRecentLibrary(createDefaultAppSettingsV1(), {
        path: "/tmp/Main Shop Materials",
        name: "Main Shop Materials",
      });

      await writeAppSettings(fs, settingsDir, initial);
      const loaded = await readAppSettings(fs, settingsDir);

      expect(loaded.recentLibraries).toHaveLength(1);
      expect(loaded.recentLibraries[0]?.name).toBe("Main Shop Materials");
    } finally {
      await rm(settingsDir, { recursive: true, force: true });
    }
  });

  it("moves touched libraries to the front and removes entries", () => {
    const first = touchRecentLibrary(createDefaultAppSettingsV1(), {
      path: "/a",
      name: "A",
    });
    const second = touchRecentLibrary(first, { path: "/b", name: "B" });
    const reopened = touchRecentLibrary(second, { path: "/a", name: "A" });
    const trimmed = removeRecentLibrary(reopened, "/a");

    expect(reopened.recentLibraries.map((entry) => entry.path)).toEqual(["/a", "/b"]);
    expect(trimmed.recentLibraries.map((entry) => entry.path)).toEqual(["/b"]);
  });

  it("clears defaultLibraryOnLaunch when removing that library", () => {
    const withLibraries = touchRecentLibrary(
      touchRecentLibrary(createDefaultAppSettingsV1(), { path: "/a", name: "A" }),
      { path: "/b", name: "B" },
    );
    const configured = { ...withLibraries, defaultLibraryOnLaunch: "/a" as const };

    const removed = removeLibraryFromAppSettings(configured, "/a");

    expect(removed.recentLibraries.map((entry) => entry.path)).toEqual(["/b"]);
    expect(removed.defaultLibraryOnLaunch).toBeNull();
  });

  it("keeps defaultLibraryOnLaunch when removing a different library", () => {
    const withLibraries = touchRecentLibrary(
      touchRecentLibrary(createDefaultAppSettingsV1(), { path: "/a", name: "A" }),
      { path: "/b", name: "B" },
    );
    const configured = { ...withLibraries, defaultLibraryOnLaunch: "/a" as const };

    const removed = removeLibraryFromAppSettings(configured, "/b");

    expect(removed.recentLibraries.map((entry) => entry.path)).toEqual(["/a"]);
    expect(removed.defaultLibraryOnLaunch).toBe("/a");
  });
});
