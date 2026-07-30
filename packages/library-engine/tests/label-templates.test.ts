import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import {
  createStarterLabelTemplates,
  STARTER_LABEL_TEMPLATE_4X6_ID,
  STARTER_LABEL_TEMPLATE_LETTER_ID,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { createLibrary, openLibrary } from "../src/index.js";
import {
  addLabelTemplate,
  deleteLabelTemplate,
  setDefaultLabelTemplate,
  updateLabelTemplate,
} from "../src/library-config.js";
import { migrateLibraryConfig } from "../src/migrations/index.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/libraries");

describe("label template seeding and migration", () => {
  it("seeds 4×6 (default) and 8.5×11 starters when creating a library", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-labels-"));

    try {
      const library = await createLibrary(fs, parentDir, "Label Shop");

      expect(library.config.labelTemplates.map((t) => t.id)).toEqual([
        STARTER_LABEL_TEMPLATE_4X6_ID,
        STARTER_LABEL_TEMPLATE_LETTER_ID,
      ]);
      expect(library.config.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_4X6_ID);
      expect(library.config.labelTemplates[0]?.contentKeys).toEqual([
        "family",
        "alloy",
        "temper",
        "material_id",
        "qr",
      ]);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("migrates legacy labelTemplate standard-qr to starters with 4×6 default", () => {
    const migrated = migrateLibraryConfig({
      version: 1,
      name: "Legacy Shop",
      idStrategy: "numeric",
      labelTemplate: "standard-qr",
      searchAllFields: true,
    });

    expect(migrated.version).toBe(2);
    expect(migrated.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_4X6_ID);
    expect(migrated.labelTemplates).toEqual(createStarterLabelTemplates());
    expect(migrated).not.toHaveProperty("labelTemplate");
  });
});

describe("label template invariants", () => {
  const starters = createStarterLabelTemplates();
  const base = {
    version: 2 as const,
    name: "Shop",
    idStrategy: "numeric",
    labelTemplates: starters,
    defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
    searchAllFields: false,
  };

  it("cannot delete the last label template", () => {
    const onlyOne = {
      ...base,
      labelTemplates: [starters[0]!],
      defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
    };

    expect(() => deleteLabelTemplate(onlyOne, STARTER_LABEL_TEMPLATE_4X6_ID)).toThrow(
      /last Label Template/i,
    );
  });

  it("reassigns default when deleting the default template", () => {
    const next = deleteLabelTemplate(base, STARTER_LABEL_TEMPLATE_4X6_ID);

    expect(next.labelTemplates.map((t) => t.id)).toEqual([STARTER_LABEL_TEMPLATE_LETTER_ID]);
    expect(next.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_LETTER_ID);
  });

  it("rejects a default id that does not reference a template", () => {
    expect(() => setDefaultLabelTemplate(base, "missing")).toThrow(/default/i);
  });

  it("keeps default valid when adding and updating templates", () => {
    const custom = {
      id: "custom-1",
      name: "Custom",
      size: { kind: "custom" as const, widthIn: 3, heightIn: 2 },
      displayUnit: "in" as const,
      contentKeys: ["material_id"],
    };

    const withAdded = addLabelTemplate(base, custom);
    expect(withAdded.labelTemplates).toHaveLength(3);
    expect(withAdded.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_4X6_ID);

    const renamed = updateLabelTemplate(withAdded, { ...custom, name: "Renamed" });
    expect(renamed.labelTemplates.find((t) => t.id === "custom-1")?.name).toBe("Renamed");

    const withDefault = setDefaultLabelTemplate(renamed, "custom-1");
    expect(withDefault.defaultLabelTemplateId).toBe("custom-1");
  });
});

describe("openLibrary migrates legacy library.json", () => {
  it("returns starter templates for a fixture still on disk as v1 standard-qr", async () => {
    const fs = createNodeFileSystem();
    const library = await openLibrary(fs, join(fixturesRoot, "empty"));

    expect(library.config.version).toBe(2);
    expect(library.config.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_4X6_ID);
    expect(library.config.labelTemplates.map((t) => t.id)).toContain(
      STARTER_LABEL_TEMPLATE_LETTER_ID,
    );
  });
});
