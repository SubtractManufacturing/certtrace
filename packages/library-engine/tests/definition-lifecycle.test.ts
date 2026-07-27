import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  createLibrary,
  createMaterial,
  getMaterial,
  openLibrary,
  removeSchemaDefinition,
  updateFieldSchema,
} from "../src/index.js";

describe("schema definition lifecycle", () => {
  it("disables a field for new entries without erasing existing material values", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main");
      await updateFieldSchema(library, {
        ...library.fieldSchema,
        fields: library.fieldSchema.fields.map((field) =>
          field.key === "supplier" ? { ...field, required: true } : field,
        ),
      });
      const material = await createMaterial(library, {
        materialCode: "AL",
        fields: { supplier: "mcmaster" },
      });

      await removeSchemaDefinition(library, {
        definitionType: "field",
        key: "supplier",
        strategy: { type: "disable" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields.find((field) => field.key === "supplier")).toMatchObject({
        disabled: true,
        required: true,
      });
      expect((await getMaterial(reopened, material.id)).fields.supplier).toBe("mcmaster");
      await expect(
        createMaterial(reopened, {
          materialCode: "AL",
          fields: { supplier: "boedecker" },
        }),
      ).rejects.toThrow('Field "Supplier" is disabled for new entries.');
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("disables an identifier kind without erasing existing material values", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main");
      const material = await createMaterial(library, {
        materialCode: "AL",
        identifiers: { heat_number: "H-100" },
      });

      await removeSchemaDefinition(library, {
        definitionType: "identifierKind",
        key: "heat_number",
        strategy: { type: "disable" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(
        reopened.fieldSchema.identifierKinds.find((kind) => kind.key === "heat_number"),
      ).toMatchObject({ disabled: true, required: false });
      expect((await getMaterial(reopened, material.id)).identifiers.heat_number).toBe("H-100");
      await expect(
        createMaterial(reopened, {
          materialCode: "AL",
          identifiers: { heat_number: "H-200" },
        }),
      ).rejects.toThrow('Identifier kind "Heat Number" is disabled for new entries.');
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("deletes a field, its values, and dependencies on it", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main");
      const material = await createMaterial(library, {
        materialCode: "AL",
        fields: { family: "aluminum", alloy: "6061" },
      });

      await removeSchemaDefinition(library, {
        definitionType: "field",
        key: "family",
        strategy: { type: "delete" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields.some((field) => field.key === "family")).toBe(false);
      expect(
        reopened.fieldSchema.fields.filter((field) => field.dependsOn?.fieldKey === "family"),
      ).toEqual([]);
      expect((await getMaterial(reopened, material.id)).fields).toEqual({ alloy: "6061" });
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("deletes an identifier kind and its values", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main");
      const material = await createMaterial(library, {
        materialCode: "AL",
        identifiers: { heat_number: "H-100", lot_number: "L-200" },
      });

      await removeSchemaDefinition(library, {
        definitionType: "identifierKind",
        key: "heat_number",
        strategy: { type: "delete" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.identifierKinds.some((kind) => kind.key === "heat_number")).toBe(
        false,
      );
      expect((await getMaterial(reopened, material.id)).identifiers).toEqual({
        lot_number: "L-200",
      });
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("drops table columns when their field or identifier kind is deleted", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main");
      await updateFieldSchema(library, {
        ...library.fieldSchema,
        tableColumns: [
          { kind: "id" },
          { kind: "field", key: "supplier" },
          { kind: "identifier", key: "heat_number" },
        ],
      });

      await removeSchemaDefinition(library, {
        definitionType: "field",
        key: "supplier",
        strategy: { type: "delete" },
      });
      await removeSchemaDefinition(library, {
        definitionType: "identifierKind",
        key: "heat_number",
        strategy: { type: "delete" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.tableColumns).toEqual([{ kind: "id" }]);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("replaces a field and remaps its values across materials", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, {
        name: "Main",
        fieldSchema: {
          ...structuredClone(defaultFieldSchemaV1),
          fields: [
            ...structuredClone(defaultFieldSchemaV1.fields),
            {
              key: "legacy_location",
              label: "Legacy Location",
              type: "text",
              required: false,
              filterable: true,
            },
          ],
        },
      });
      const material = await createMaterial(library, {
        materialCode: "AL",
        fields: { legacy_location: "Rack A1" },
      });

      await removeSchemaDefinition(library, {
        definitionType: "field",
        key: "legacy_location",
        strategy: { type: "replace", targetKey: "storage_location" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.fields.some((field) => field.key === "legacy_location")).toBe(
        false,
      );
      expect((await getMaterial(reopened, material.id)).fields).toMatchObject({
        storage_location: "Rack A1",
      });
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("replaces an identifier kind and remaps its values across materials", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-definition-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main");
      const material = await createMaterial(library, {
        materialCode: "AL",
        identifiers: { heat_number: "H-100" },
      });

      await removeSchemaDefinition(library, {
        definitionType: "identifierKind",
        key: "heat_number",
        strategy: { type: "replace", targetKey: "lot_number" },
      });

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.fieldSchema.identifierKinds.some((kind) => kind.key === "heat_number")).toBe(
        false,
      );
      expect((await getMaterial(reopened, material.id)).identifiers).toEqual({
        lot_number: "H-100",
      });
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
