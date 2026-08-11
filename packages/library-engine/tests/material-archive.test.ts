import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { materialMetadataPath } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  archiveMaterial,
  createLibrary,
  createMaterial,
  filterMaterialsByArchiveState,
  getMaterial,
  listMaterials,
  openLibrary,
  removeMaterial,
  unarchiveMaterial,
  updateMaterial,
} from "../src/index.js";
import { migrateMaterialMetadata } from "../src/migrations/index.js";

describe("material archive", () => {
  it("archives and unarchives a material; state persists across reopen", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-archive-"));

    try {
      const library = await createLibrary(fs, parentDir, "Archive Shop");
      const root = library.paths.root;
      const created = await createMaterial(library, { fields: { family: "aluminum" } });

      expect(created.archived).toBe(false);

      const archived = await archiveMaterial(library, created.id);
      expect(archived.archived).toBe(true);
      expect(archived.id).toBe(created.id);
      expect(archived.updatedAt).not.toBe(created.updatedAt);

      const reopened = await openLibrary(fs, root);
      const fetched = await getMaterial(reopened, created.id);
      expect(fetched.archived).toBe(true);
      expect(fetched.id).toBe(created.id);

      const restored = await unarchiveMaterial(reopened, created.id);
      expect(restored.archived).toBe(false);

      const afterRestore = await getMaterial(await openLibrary(fs, root), created.id);
      expect(afterRestore.archived).toBe(false);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("keeps archived materials editable and hard-deletable in the same library", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-archive-"));

    try {
      const library = await createLibrary(fs, parentDir, "Archive Shop");
      const created = await createMaterial(library, {
        fields: { family: "aluminum", storage_location: "Rack A1" },
      });
      await archiveMaterial(library, created.id);

      const updated = await updateMaterial(library, created.id, {
        fields: { storage_location: "Rack Z9", notes: "Still editable while archived" },
      });
      expect(updated.archived).toBe(true);
      expect(updated.fields.storage_location).toBe("Rack Z9");
      expect(updated.fields.notes).toBe("Still editable while archived");

      await removeMaterial(library, created.id);
      expect(await listMaterials(await openLibrary(fs, library.paths.root))).toHaveLength(0);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("filters materials by active, archived, and all shelf states", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-archive-"));

    try {
      const library = await createLibrary(fs, parentDir, "Archive Shop");
      const active = await createMaterial(library, { fields: { family: "aluminum" } });
      const archived = await createMaterial(library, { fields: { family: "aluminum" } });
      await archiveMaterial(library, archived.id);

      const materials = await listMaterials(library);
      expect(filterMaterialsByArchiveState(materials, "active").map((m) => m.id)).toEqual([
        active.id,
      ]);
      expect(filterMaterialsByArchiveState(materials, "archived").map((m) => m.id)).toEqual([
        archived.id,
      ]);
      expect(
        filterMaterialsByArchiveState(materials, "all")
          .map((m) => m.id)
          .sort(),
      ).toEqual([active.id, archived.id].sort());
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("opens legacy material metadata without archived as active", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-archive-"));

    try {
      const library = await createLibrary(fs, parentDir, "Legacy Shop");
      const created = await createMaterial(library, { fields: { family: "aluminum" } });
      const metadataPath = join(library.paths.root, materialMetadataPath(created.id));
      const onDisk = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
      delete onDisk.archived;
      await writeFile(metadataPath, `${JSON.stringify(onDisk, null, 2)}\n`);

      const migrated = migrateMaterialMetadata(JSON.parse(await readFile(metadataPath, "utf8")));
      expect(migrated.archived).toBe(false);

      const fetched = await getMaterial(await openLibrary(fs, library.paths.root), created.id);
      expect(fetched.archived).toBe(false);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
