import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { materialMetadataPath } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  createLibrary,
  createMaterial,
  getMaterial,
  listMaterials,
  openLibrary,
  updateMaterial,
} from "../src/index.js";

describe("material CRUD", () => {
  it("creates, reads, and updates field and identifier values on disk", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-material-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main Shop Materials");
      const root = library.paths.root;
      const created = await createMaterial(library, {
        materialCode: "AL",
        fields: {
          family: "aluminum",
          alloy: "6061",
          temper: "t6",
          supplier: "mcmaster",
          storage_location: "Rack B2",
        },
        identifiers: {
          heat_number: "A4921",
        },
      });

      expect(created.id).toMatch(/^al-/);
      expect(created.fields.family).toBe("aluminum");
      expect(created.identifiers.heat_number).toBe("A4921");

      const metadataPath = join(root, materialMetadataPath(created.id));
      const onDisk = JSON.parse(await readFile(metadataPath, "utf8"));
      expect(onDisk.fields.alloy).toBe("6061");
      expect(onDisk.identifiers.heat_number).toBe("A4921");
      expect(onDisk.material).toBeUndefined();
      expect(onDisk.barcode).toBeUndefined();

      const listed = await listMaterials(await openLibrary(fs, root));
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(created.id);

      const fetched = await getMaterial(library, created.id);
      expect(fetched.fields.supplier).toBe("mcmaster");

      const updated = await updateMaterial(library, created.id, {
        fields: {
          storage_location: "Rack C1",
          notes: "Moved after QA sign-off",
        },
        identifiers: {
          purchase_order: "PO-1001",
        },
      });
      expect(updated.fields.storage_location).toBe("Rack C1");
      expect(updated.fields.notes).toBe("Moved after QA sign-off");
      expect(updated.fields.family).toBe("aluminum");
      expect(updated.identifiers.heat_number).toBe("A4921");
      expect(updated.identifiers.purchase_order).toBe("PO-1001");
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("allows the same identifier value on multiple materials", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-material-"));

    try {
      const library = await createLibrary(fs, parentDir, "Sandbox");
      const root = library.paths.root;
      const first = await createMaterial(library, {
        materialCode: "AL",
        identifiers: { purchase_order: "PO-SHARED" },
      });
      const second = await createMaterial(await openLibrary(fs, root), {
        materialCode: "AL",
        identifiers: { purchase_order: "PO-SHARED" },
      });

      expect(first.id).not.toBe(second.id);
      expect(first.identifiers.purchase_order).toBe("PO-SHARED");
      expect(second.identifiers.purchase_order).toBe("PO-SHARED");
      expect(await listMaterials(await openLibrary(fs, root))).toHaveLength(2);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
