import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { formatDimensionValue, formatMaterialSize, parseDimensionValue } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  compareSizeSortKeys,
  createFieldDefinition,
  createLibrary,
  createMaterial,
  formatMaterialSize as formatFromEngine,
  getMaterial,
  openLibrary,
  removeSchemaDefinition,
  updateFieldSchema,
  updateMaterial,
} from "../src/index.js";

describe("Size sorting", () => {
  it("keeps empty Sizes last in both directions", () => {
    expect(compareSizeSortKeys([25.4], undefined, "asc")).toBeLessThan(0);
    expect(compareSizeSortKeys([25.4], undefined, "desc")).toBeLessThan(0);
    expect(compareSizeSortKeys(undefined, [25.4], "asc")).toBeGreaterThan(0);
    expect(compareSizeSortKeys(undefined, [25.4], "desc")).toBeGreaterThan(0);
    expect(compareSizeSortKeys([25.4], [50.8], "asc")).toBeLessThan(0);
    expect(compareSizeSortKeys([25.4], [50.8], "desc")).toBeGreaterThan(0);
  });
});

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

      const changedAgain = await updateMaterial(library, created.id, {
        fields: { shape: "rect_bar" },
      });
      expect(changedAgain.fields.width).toBeUndefined();
      expect(changedAgain.fields.shape).toBe("rect_bar");
      expect(changedAgain.sizeUnit).toBe("in");
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

  it("rejects conflicting unit suffixes on one Size", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      await expect(
        createMaterial(library, {
          fields: { family: "aluminum", shape: "rect_bar", width: 2, height: 50 },
          sizeUnit: "in",
          dimensionUnits: { width: "in", height: "mm" },
        }),
      ).rejects.toThrow(/mixed units/i);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("uses an explicit dimension suffix as the Size unit", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const created = await createMaterial(library, {
        fields: { family: "aluminum", shape: "square_bar", width: 12 },
        dimensionUnits: { width: "mm" },
      });
      expect(created.sizeUnit).toBe("mm");
      expect(formatMaterialSize(library.fieldSchema, created)).toBe("12 x 12 mm");
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

  it("clears Shape and Size on materials when a Shape option is removed", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const hex = await createMaterial(library, {
        fields: { family: "aluminum", shape: "hex_bar", width: 1 },
        sizeUnit: "in",
      });
      const plate = await createMaterial(library, {
        fields: { family: "aluminum", shape: "plate", thickness: 0.5 },
        sizeUnit: "in",
      });

      await updateFieldSchema(library, {
        ...library.fieldSchema,
        fields: library.fieldSchema.fields.map((field) =>
          field.key === "shape"
            ? { ...field, options: field.options?.filter((option) => option.id !== "hex_bar") }
            : field,
        ),
      });

      const reopened = await openLibrary(fs, library.paths.root);
      const hexFetched = await getMaterial(reopened, hex.id);
      expect(hexFetched.fields.shape).toBeUndefined();
      expect(hexFetched.fields.width).toBeUndefined();
      expect(hexFetched.sizeUnit).toBeUndefined();

      const plateFetched = await getMaterial(reopened, plate.id);
      expect(plateFetched.fields.shape).toBe("plate");
      expect(plateFetched.fields.thickness).toBe(0.5);
      expect(plateFetched.sizeUnit).toBe("in");
      expect(
        reopened.fieldSchema.fields
          .find((field) => field.key === "shape")
          ?.options?.some((option) => option.id === "hex_bar"),
      ).toBe(false);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("clears stale dimensions when an existing Shape option drops a key", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const square = await createMaterial(library, {
        fields: { family: "aluminum", shape: "square_bar", width: 2 },
        sizeUnit: "in",
      });
      const plate = await createMaterial(library, {
        fields: { family: "aluminum", shape: "plate", thickness: 0.5 },
        sizeUnit: "in",
      });

      await updateFieldSchema(library, {
        ...library.fieldSchema,
        fields: library.fieldSchema.fields.map((field) =>
          field.key === "shape"
            ? {
                ...field,
                options: field.options?.map((option) =>
                  option.id === "square_bar"
                    ? { ...option, dimensionKeys: [], sizePattern: undefined }
                    : option,
                ),
              }
            : field,
        ),
      });

      const reopened = await openLibrary(fs, library.paths.root);
      const squareFetched = await getMaterial(reopened, square.id);
      expect(squareFetched.fields.shape).toBe("square_bar");
      expect(squareFetched.fields.width).toBeUndefined();
      expect(squareFetched.sizeUnit).toBeUndefined();

      const plateFetched = await getMaterial(reopened, plate.id);
      expect(plateFetched.fields.shape).toBe("plate");
      expect(plateFetched.fields.thickness).toBe(0.5);
      expect(plateFetched.sizeUnit).toBe("in");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("strips a custom dimension from Shape options, patterns, and Materials", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-size-"));

    try {
      const library = await createLibrary(fs, parentDir, "Size Shop");
      const legA = createFieldDefinition(library.fieldSchema, "Leg A", "number");
      await updateFieldSchema(library, {
        ...library.fieldSchema,
        fields: [
          ...library.fieldSchema.fields.map((field) => {
            if (field.key !== "shape") {
              return field;
            }
            return {
              ...field,
              options: [
                ...(field.options ?? []).map((option) =>
                  option.id === "square_bar"
                    ? {
                        ...option,
                        dimensionKeys: [...(option.dimensionKeys ?? []), "leg_a"],
                        sizePattern: "{width} x {width} x {leg_a} {unit}",
                      }
                    : option,
                ),
                {
                  id: "angle",
                  label: "Angle",
                  dimensionKeys: ["leg_a"],
                  sizePattern: "{leg_a} {unit}",
                },
              ],
            };
          }),
          legA,
        ],
      });

      const square = await createMaterial(library, {
        fields: { family: "aluminum", shape: "square_bar", width: 2, leg_a: 0.25 },
        sizeUnit: "in",
      });
      const angle = await createMaterial(library, {
        fields: { family: "aluminum", shape: "angle", leg_a: 1 },
        sizeUnit: "in",
      });

      await removeSchemaDefinition(library, {
        definitionType: "field",
        key: "leg_a",
        strategy: { type: "delete" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields.some((field) => field.key === "leg_a")).toBe(false);

      const shapeOptions = reopened.fieldSchema.fields.find(
        (field) => field.key === "shape",
      )?.options;
      const squareOption = shapeOptions?.find((option) => option.id === "square_bar");
      const angleOption = shapeOptions?.find((option) => option.id === "angle");
      expect(squareOption?.dimensionKeys).toEqual(["width"]);
      expect(squareOption?.sizePattern).toBe("{width} x {width} {unit}");
      expect(angleOption?.dimensionKeys).toBeUndefined();
      expect(angleOption?.sizePattern).toBeUndefined();

      const squareFetched = await getMaterial(reopened, square.id);
      expect(squareFetched.fields.leg_a).toBeUndefined();
      expect(squareFetched.fields.width).toBe(2);
      expect(squareFetched.sizeUnit).toBe("in");
      expect(formatMaterialSize(reopened.fieldSchema, squareFetched)).toBe("2 x 2 in");

      const angleFetched = await getMaterial(reopened, angle.id);
      expect(angleFetched.fields.leg_a).toBeUndefined();
      expect(angleFetched.fields.shape).toBe("angle");
      expect(angleFetched.sizeUnit).toBeUndefined();
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
