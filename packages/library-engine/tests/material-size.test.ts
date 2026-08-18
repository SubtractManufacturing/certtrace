import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { formatDimensionValue, formatMaterialSize, parseDimensionValue } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  createLibrary,
  createMaterial,
  formatMaterialSize as formatFromEngine,
  getMaterial,
  openLibrary,
  removeSchemaDefinition,
  updateMaterial,
} from "../src/index.js";

describe("size parse and format", () => {
  it("parses bare numbers, fractions, and suffixes", () => {
    expect(parseDimensionValue("2", "in")).toEqual({ value: 2 });
    expect(parseDimensionValue("0.125", "in")).toEqual({ value: 0.125 });
    expect(parseDimensionValue(".125", "in")).toEqual({ value: 0.125 });
    expect(parseDimensionValue("1/2", "in")).toEqual({ value: 0.5 });
    expect(parseDimensionValue('1/2"', "in")).toEqual({ value: 0.5, unit: "in" });
    expect(parseDimensionValue("12mm", "in")).toEqual({ value: 12, unit: "mm" });
    expect(parseDimensionValue("12 mm", "in")).toEqual({ value: 12, unit: "mm" });
    expect(parseDimensionValue("0.5in", "in")).toEqual({ value: 0.5, unit: "in" });
  });

  it("formats with leading zeros and no trailing zeros", () => {
    expect(formatDimensionValue(0.125)).toBe("0.125");
    expect(formatDimensionValue(0.5)).toBe("0.5");
    expect(formatDimensionValue(2)).toBe("2");
  });
});

describe("material Size on disk", () => {
  it("saves square bar Size and renders 2 x 2 in", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const created = await createMaterial(library, {
        fields: { family: "aluminum", shape: "square_bar", width: 2 },
        sizeUnit: "in",
      });

      const reopened = await openLibrary(fs, library.paths.root);
      const fetched = await getMaterial(reopened, created.id);
      expect(fetched.sizeUnit).toBe("in");
      expect(fetched.fields.width).toBe(2);

      const sizeText = formatMaterialSize(reopened.fieldSchema, fetched);
      expect(sizeText).toBe("2 x 2 in");
      expect(formatFromEngine(reopened.fieldSchema, fetched)).toBe("2 x 2 in");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("allows incomplete Size and strips dimensions not on the Shape", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const created = await createMaterial(library, {
        fields: { family: "aluminum", shape: "round_tube", od: 2, wall: 0.125, width: 99 },
        sizeUnit: "in",
      });

      const fetched = await getMaterial(library, created.id);
      expect(fetched.fields.width).toBeUndefined();
      expect(formatMaterialSize(library.fieldSchema, fetched)).toBe("2 x 0.125 in");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("clears Size when Shape is cleared", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const created = await createMaterial(library, {
        fields: { family: "aluminum", shape: "plate", thickness: 0.5 },
        sizeUnit: "in",
      });

      const updated = await updateMaterial(library, created.id, {
        fields: { family: "aluminum" },
        sizeUnit: null,
        replaceFields: true,
      });

      expect(updated.fields.thickness).toBeUndefined();
      expect(updated.sizeUnit).toBeUndefined();
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("keeps unit when Shape changes and clears dimension values", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const created = await createMaterial(library, {
        fields: { family: "aluminum", shape: "plate", thickness: 0.5 },
        sizeUnit: "in",
      });

      const updated = await updateMaterial(library, created.id, {
        fields: { family: "aluminum", shape: "square_bar", width: 2 },
        sizeUnit: "in",
        replaceFields: true,
      });

      expect(updated.fields.thickness).toBeUndefined();
      expect(updated.fields.width).toBe(2);
      expect(updated.sizeUnit).toBe("in");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("rejects Size without unit when dimensions are filled", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      await expect(
        createMaterial(library, {
          fields: { family: "aluminum", shape: "square_bar", width: 2 },
        }),
      ).rejects.toThrow(/unit/i);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("refuses to delete shipped dimension fields", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      await expect(
        removeSchemaDefinition(library, {
          definitionType: "field",
          key: "width",
          strategy: { type: "delete" },
        }),
      ).rejects.toThrow(/cannot be deleted/i);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
