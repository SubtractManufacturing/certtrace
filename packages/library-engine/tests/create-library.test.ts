import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@certtrace/file-storage";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import {
  CERTTRACE_DIR,
  FIELD_SCHEMA_JSON,
  JOBS_DIR,
  LABELS_DIR,
  LIBRARY_JSON,
  LIBRARY_README,
  MATERIALS_DIR,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  addFieldOption,
  changeFieldType,
  createFieldDefinition,
  createFieldOption,
  createIdentifierKind,
  createLibrary,
  createMaterial,
  getMaterial,
  openLibrary,
  updateFieldSchema,
} from "../src/index.js";

describe("createLibrary", () => {
  it("creates a named library folder with readme and contract", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-lib-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main Shop Materials");

      expect(library.config.name).toBe("Main Shop Materials");
      expect(library.paths.root).toBe(join(parentDir, "Main Shop Materials"));
      expect(library.paths.certtrace.endsWith(CERTTRACE_DIR)).toBe(true);

      const readme = await readFile(join(library.paths.root, LIBRARY_README), "utf8");
      expect(readme).toContain("CertTrace material library");
      expect(readme).toContain("Main Shop Materials");

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.config.idStrategy).toBe("material-animal-number");
      expect(reopened.namingRules.strategies.length).toBeGreaterThan(0);
      expect(Object.keys(reopened.wordLists.lists)).toContain("animals");
      expect(reopened.fieldSchema.fields.map((field) => field.key)).toEqual([
        "family",
        "alloy",
        "temper",
        "traceability_type",
        "shape",
        "thickness",
        "diameter",
        "width",
        "height",
        "od",
        "wall",
        "supplier",
        "date_received",
        "storage_location",
        "notes",
      ]);
      expect(reopened.fieldSchema.fields.find((field) => field.key === "family")?.label).toBe(
        "Material",
      );
      expect(reopened.fieldSchema.identifierKinds.map((kind) => kind.key)).toEqual([
        "heat_number",
        "lot_number",
        "purchase_order",
      ]);
      expect(reopened.fieldSchema.attachmentKinds.map((kind) => kind.key)).toEqual([
        "mtr",
        "heat_cert",
        "coc",
        "other",
      ]);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates a library when the parent directory does not exist yet", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-new-parent-"));

    try {
      const library = await createLibrary(fs, parentDir, "Nested Library");
      expect(library.paths.root).toBe(join(parentDir, "Nested Library"));
      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.config.name).toBe("Nested Library");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates a library when readdir throws a Windows missing-path string", async () => {
    const nodeFs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-win-missing-"));
    const libraryRoot = join(parentDir, "Main Shop Materials");
    const fs: FileSystem = {
      ...nodeFs,
      readdir: async (path) => {
        if (path === libraryRoot) {
          throw `failed to read directory at path: ${libraryRoot} with error: The system cannot find the path specified. (os error 3)`;
        }
        return nodeFs.readdir(path);
      },
    };

    try {
      const library = await createLibrary(fs, parentDir, "Main Shop Materials");

      expect(library.paths.root).toBe(libraryRoot);
      const readme = await readFile(join(library.paths.root, LIBRARY_README), "utf8");
      expect(readme).toContain("Main Shop Materials");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates expected relative paths inside the library folder", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-lib-"));

    try {
      const library = await createLibrary(fs, parentDir, "QA Archive");
      const opened = await openLibrary(fs, library.paths.root);

      expect(opened.paths.libraryJson.endsWith(LIBRARY_JSON)).toBe(true);
      expect(opened.paths.namingRulesJson.endsWith(NAMING_RULES_JSON)).toBe(true);
      expect(opened.paths.wordListsJson.endsWith(WORD_LISTS_JSON)).toBe(true);
      expect(opened.paths.fieldSchemaJson.endsWith(FIELD_SCHEMA_JSON)).toBe(true);
      expect(opened.paths.materials.endsWith(MATERIALS_DIR)).toBe(true);
      expect(opened.paths.jobs.endsWith(JOBS_DIR)).toBe(true);
      expect(opened.paths.labels.endsWith(LABELS_DIR)).toBe(true);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("persists a confirmed dependent select option for the selected parent", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-option-"));

    try {
      const library = await createLibrary(fs, parentDir, "Option Library");
      const result = await addFieldOption(library, {
        fieldKey: "alloy",
        label: "5052 H32",
        currentValues: { family: "aluminum" },
      });

      expect(result.option).toEqual({ id: "5052_h32", label: "5052 H32" });

      const reopened = await openLibrary(fs, library.paths.root);
      const alloy = reopened.fieldSchema.fields.find((field) => field.key === "alloy");
      expect(alloy?.options).toContainEqual(result.option);
      expect(alloy?.dependsOn?.filterOptionsBy?.aluminum).toContain(result.option.id);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("persists schema settings across reopen without orphaning stable-key values", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-schema-settings-"));

    try {
      const library = await createLibrary(fs, parentDir, "Configured Library");
      const material = await createMaterial(library, {
        fields: { family: "aluminum" },
        identifiers: { heat_number: "H-42" },
      });
      const family = library.fieldSchema.fields.find((field) => field.key === "family")!;
      const updatedFamily = {
        ...family,
        label: "Stock family",
        required: true,
        options: family.options?.map((option) =>
          option.id === "aluminum" ? { ...option, label: "Aluminium", shortCode: "AU" } : option,
        ),
      };
      const heatNumber = library.fieldSchema.identifierKinds.find(
        (kind) => kind.key === "heat_number",
      )!;
      const nextSchema = {
        ...library.fieldSchema,
        fields: [
          library.fieldSchema.fields.find((field) => field.key === "alloy")!,
          updatedFamily,
          ...library.fieldSchema.fields.filter(
            (field) => field.key !== "alloy" && field.key !== "family",
          ),
        ],
        identifierKinds: [
          { ...heatNumber, label: "Mill Heat", required: true },
          ...library.fieldSchema.identifierKinds.filter((kind) => kind.key !== "heat_number"),
          { key: "mill_cert", label: "Mill cert", required: false, filterable: true },
        ],
      };

      await updateFieldSchema(library, nextSchema);

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields.slice(0, 2).map((field) => field.key)).toEqual([
        "alloy",
        "family",
      ]);
      expect(reopened.fieldSchema.fields[1]).toMatchObject({
        key: "family",
        label: "Stock family",
        required: true,
      });
      expect(reopened.fieldSchema.fields[1]?.options?.[0]).toEqual({
        id: "aluminum",
        label: "Aluminium",
        shortCode: "AU",
      });
      expect(reopened.fieldSchema.identifierKinds[0]).toMatchObject({
        key: "heat_number",
        label: "Mill Heat",
        required: true,
      });
      expect(reopened.fieldSchema.identifierKinds.at(-1)?.key).toBe("mill_cert");

      const persistedMaterial = await getMaterial(reopened, material.id);
      expect(persistedMaterial.fields.family).toBe("aluminum");
      expect(persistedMaterial.identifiers.heat_number).toBe("H-42");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("constructs typed schema definitions with stable keys and persists type changes", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-schema-definitions-"));

    try {
      const library = await createLibrary(fs, parentDir, "Schema Definitions");
      const family = library.fieldSchema.fields.find((field) => field.key === "family")!;
      const changedFamily = changeFieldType(family, "text");
      const addedField = createFieldDefinition(library.fieldSchema, "Inspection score", "number");
      const addedKind = createIdentifierKind(library.fieldSchema, "Mill cert");
      const addedOption = createFieldOption(family, "Titanium");

      expect(addedField).toMatchObject({ key: "inspection_score", type: "number" });
      expect(addedKind).toMatchObject({ key: "mill_cert", required: false });
      expect(addedOption).toEqual({ id: "titanium", label: "Titanium" });

      await updateFieldSchema(library, {
        ...library.fieldSchema,
        fields: [
          changedFamily,
          ...library.fieldSchema.fields.filter((field) => field.key !== "family"),
          addedField,
        ],
        identifierKinds: [...library.fieldSchema.identifierKinds, addedKind],
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields[0]).toEqual({
        key: "family",
        label: "Material",
        type: "text",
        required: false,
        filterable: true,
      });
      expect(reopened.fieldSchema.fields.at(-1)?.key).toBe("inspection_score");
      expect(reopened.fieldSchema.identifierKinds.at(-1)?.key).toBe("mill_cert");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("rejects cyclic field dependencies without overwriting the persisted schema", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-schema-cycle-"));

    try {
      const library = await createLibrary(fs, parentDir, "Dependency Cycle");
      const cyclicSchema = {
        ...library.fieldSchema,
        fields: library.fieldSchema.fields.map((field) =>
          field.key === "family"
            ? {
                ...field,
                dependsOn: {
                  fieldKey: "alloy",
                  filterOptionsBy: {},
                },
              }
            : field,
        ),
      };

      await expect(updateFieldSchema(library, cyclicSchema)).rejects.toThrow(
        "Field dependencies cannot contain a cycle",
      );

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields.find((field) => field.key === "family")?.dependsOn).toBe(
        undefined,
      );
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
