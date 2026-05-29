import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeFileSystem } from "@certtrace/file-storage";
import { materialMetadataPath } from "@certtrace/types";
import {
  createLibrary,
  createMaterial,
  getMaterial,
  listMaterials,
  openLibrary,
  updateMaterial,
} from "../src/index.js";

describe("material CRUD", () => {
  it("creates, reads, and updates material metadata on disk", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-material-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main Shop Materials");
      const root = library.paths.root;
      const created = await createMaterial(library, {
        materialCode: "AL",
        material: "6061-T6",
        supplier: "McMaster",
        heat: "A4921",
        location: "Rack B2",
        tags: ["aluminum"],
      });

      expect(created.id).toMatch(/^al-/);
      expect(created.barcode).toBe(created.id);

      const metadataPath = join(root, materialMetadataPath(created.id));
      const onDisk = JSON.parse(await readFile(metadataPath, "utf8"));
      expect(onDisk.material).toBe("6061-T6");

      const listed = await listMaterials(await openLibrary(fs, root));
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(created.id);

      const fetched = await getMaterial(library, created.id);
      expect(fetched.supplier).toBe("McMaster");

      const updated = await updateMaterial(library, created.id, {
        location: "Rack C1",
        notes: "Moved after QA sign-off",
      });
      expect(updated.location).toBe("Rack C1");
      expect(updated.notes).toBe("Moved after QA sign-off");
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("generates unique ids for successive materials", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-material-"));

    try {
      const library = await createLibrary(fs, parentDir, "Sandbox");
      const root = library.paths.root;
      const first = await createMaterial(library, { materialCode: "AL" });
      const second = await createMaterial(await openLibrary(fs, root), { materialCode: "AL" });

      expect(first.id).not.toBe(second.id);
      expect(await listMaterials(await openLibrary(fs, root))).toHaveLength(2);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
