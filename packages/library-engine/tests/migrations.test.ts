import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNodeFileSystem } from "@certtrace/file-storage";
import {
  migrateLibraryConfig,
  migrateMaterialMetadata,
} from "../src/migrations/index.js";
import { LibraryError, listMaterialIds, openLibrary } from "../src/index.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/libraries");

describe("schema migrations", () => {
  it("passes through valid v1 library config unchanged", async () => {
    const raw = await readFile(join(fixturesRoot, "small/.certtrace/library.json"), "utf8");
    const parsed = migrateLibraryConfig(JSON.parse(raw));

    expect(parsed.name).toBe("Main Shop Materials");
    expect(parsed.version).toBe(1);
  });

  it("passes through valid v1 material metadata unchanged", async () => {
    const raw = await readFile(
      join(fixturesRoot, "small/materials/AL-falcon-104/metadata.json"),
      "utf8",
    );
    const parsed = migrateMaterialMetadata(JSON.parse(raw));

    expect(parsed.id).toBe("AL-falcon-104");
    expect(parsed.version).toBe(1);
  });

  it("rejects libraries created with a newer schema version", () => {
    expect(() =>
      migrateLibraryConfig({
        version: 99,
        name: "Future Library",
        idStrategy: "numeric",
        labelTemplate: "standard-qr",
        searchAllFields: true,
      }),
    ).toThrow(/newer CertTrace/);
  });

  it("rejects broken fixture config during openLibrary", async () => {
    const fs = createNodeFileSystem();
    await expect(openLibrary(fs, join(fixturesRoot, "broken"))).rejects.toBeInstanceOf(
      LibraryError,
    );
  });

  it("opens empty fixture library with no materials", async () => {
    const fs = createNodeFileSystem();
    const library = await openLibrary(fs, join(fixturesRoot, "empty"));

    expect(library.config.name).toBe("Empty Library");
    expect(await listMaterialIds(library)).toEqual([]);
  });
});
