import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { createDefaultAppSettingsV1 } from "@certtrace/types";
import {
  readAppSettings,
  removeRecentLibrary,
  touchRecentLibrary,
  writeAppSettings,
} from "../src/app-settings.js";

describe("app settings", () => {
  it("returns defaults when settings file is missing", async () => {
    const fs = createNodeFileSystem();
    const settingsDir = await mkdtemp(join(tmpdir(), "certtrace-settings-"));

    try {
      const settings = await readAppSettings(fs, settingsDir);
      expect(settings).toEqual(createDefaultAppSettingsV1());
    } finally {
      await rm(settingsDir, { recursive: true, force: true });
    }
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
});
