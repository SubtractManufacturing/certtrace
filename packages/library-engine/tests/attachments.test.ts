import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import {
  attachFiles,
  createLibrary,
  createMaterial,
  listMaterialAttachments,
  removeMaterialAttachment,
} from "../src/index.js";

describe("material attachments", () => {
  it("lists, attaches, and removes files in the material folder", async () => {
    const fs = createNodeFileSystem();
    const tempRoot = await mkdtemp(join(tmpdir(), "certtrace-attachments-"));
    const sourceDir = await mkdtemp(join(tmpdir(), "certtrace-source-"));

    try {
      await writeFile(join(sourceDir, "cert.pdf"), "pdf-content");
      await writeFile(join(sourceDir, "photo.png"), "png-content");

      const library = await createLibrary(fs, tempRoot, "Attachment Test");
      const material = await createMaterial(library, { material: "6061-T6", materialCode: "AL" });

      expect(await listMaterialAttachments(library, material.id)).toEqual([]);

      const added = await attachFiles(library, material.id, [
        { sourcePath: join(sourceDir, "cert.pdf") },
        { sourcePath: join(sourceDir, "photo.png") },
      ]);

      expect(added).toHaveLength(2);
      expect(added.map((file) => file.kind)).toEqual(["pdf", "png"]);

      const listed = await listMaterialAttachments(library, material.id);
      expect(listed).toHaveLength(2);

      await removeMaterialAttachment(library, material.id, listed[0]!.name);
      expect(await listMaterialAttachments(library, material.id)).toHaveLength(1);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  it("deduplicates attachment filenames", async () => {
    const fs = createNodeFileSystem();
    const tempRoot = await mkdtemp(join(tmpdir(), "certtrace-attachments-dup-"));
    const sourceDir = await mkdtemp(join(tmpdir(), "certtrace-source-dup-"));

    try {
      await writeFile(join(sourceDir, "cert.pdf"), "one");
      await writeFile(join(sourceDir, "cert-copy.pdf"), "two");

      const library = await createLibrary(fs, tempRoot, "Dup Test");
      const material = await createMaterial(library, { materialCode: "AL" });

      await attachFiles(library, material.id, [{ sourcePath: join(sourceDir, "cert.pdf") }]);
      const second = await attachFiles(library, material.id, [
        { sourcePath: join(sourceDir, "cert-copy.pdf"), filename: "cert.pdf" },
      ]);

      expect(second[0]?.name).toBe("cert-2.pdf");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(sourceDir, { recursive: true, force: true });
    }
  });
});
