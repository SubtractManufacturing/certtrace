import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { describe, expect, it } from "vitest";
import { LibraryError, listMaterialIds, openLibrary } from "../src/index.js";
import { migrateLibraryConfig, migrateMaterialMetadata } from "../src/migrations/index.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/libraries");

describe("schema migrations", () => {
  it("migrates v1 library config to starter Label Templates", async () => {
    const raw = await readFile(join(fixturesRoot, "small/.certtrace/library.json"), "utf8");
    const parsed = migrateLibraryConfig(JSON.parse(raw));

    expect(parsed.name).toBe("Main Shop Materials");
    expect(parsed.version).toBe(4);
    expect(parsed.defaultLabelTemplateId).toBe("starter-4x6");
    expect(parsed.labelTemplates).toHaveLength(3);
  });

  it("migrates v1 material metadata to current schema version", async () => {
    const raw = await readFile(
      join(fixturesRoot, "small/materials/AL-falcon-104/metadata.json"),
      "utf8",
    );
    const parsed = migrateMaterialMetadata(JSON.parse(raw));

    expect(parsed.id).toBe("AL-falcon-104");
    expect(parsed.version).toBe(4);
  });

  it("rejects libraries created with a newer schema version", () => {
    expect(() =>
      migrateLibraryConfig({
        version: 99,
        name: "Future Library",
        idStrategy: "numeric",
        labelTemplates: [],
        defaultLabelTemplateId: "x",
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
