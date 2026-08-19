import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { defaultFieldSchemaV1, SHIPPED_SHAPE_PACKING } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { LibraryError, listMaterialIds, openLibrary } from "../src/index.js";
import {
  migrateFieldSchema,
  migrateLibraryConfig,
  migrateMaterialMetadata,
} from "../src/migrations/index.js";

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

  it("packs shipped Shape option ids only and leaves custom options unpacked", () => {
    const seed = structuredClone(defaultFieldSchemaV1);
    const shapeField = seed.fields.find((field) => field.key === "shape");
    const v3 = {
      ...seed,
      version: 3,
      fields: seed.fields
        .filter(
          (field) =>
            field.key !== "thickness" &&
            field.key !== "diameter" &&
            field.key !== "width" &&
            field.key !== "height" &&
            field.key !== "od" &&
            field.key !== "wall",
        )
        .map((field) => {
          if (field.key !== "shape") {
            return field;
          }
          return {
            ...field,
            options: [
              ...(shapeField?.options ?? [])
                .filter((option) => option.id !== "rect_bar")
                .map((option) => ({ id: option.id, label: option.label })),
              { id: "angle", label: "Angle" },
            ],
          };
        }),
    };

    const migrated = migrateFieldSchema(v3);
    const options = migrated.fields.find((field) => field.key === "shape")?.options ?? [];
    const plate = options.find((option) => option.id === "plate");
    const angle = options.find((option) => option.id === "angle");
    const rectBar = options.find((option) => option.id === "rect_bar");

    expect(plate).toMatchObject(SHIPPED_SHAPE_PACKING.plate);
    expect(rectBar).toMatchObject(SHIPPED_SHAPE_PACKING.rect_bar);
    expect(angle).toEqual({ id: "angle", label: "Angle" });
    expect(migrated.fields.some((field) => field.key === "width")).toBe(true);
  });
});
