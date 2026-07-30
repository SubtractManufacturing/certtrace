import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { describe, expect, it } from "vitest";
import {
  attachFiles,
  createLibrary,
  createMaterial,
  listMaterialAttachments,
  openLibrary,
  removeMaterialAttachment,
  renameMaterialAttachment,
  updateFieldSchema,
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
      const material = await createMaterial(library, { fields: { family: "aluminum" } });

      expect(await listMaterialAttachments(library, material.id)).toEqual([]);

      const added = await attachFiles(library, material.id, [
        { sourcePath: join(sourceDir, "cert.pdf") },
        { sourcePath: join(sourceDir, "photo.png") },
      ]);

      expect(added).toHaveLength(2);
      expect(added.map((file) => file.format)).toEqual(["pdf", "png"]);

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
      const material = await createMaterial(library, { fields: { family: "aluminum" } });

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

  it("persists attachment kinds across rename and delete", async () => {
    const fs = createNodeFileSystem();
    const tempRoot = await mkdtemp(join(tmpdir(), "certtrace-attachments-kinds-"));
    const sourceDir = await mkdtemp(join(tmpdir(), "certtrace-source-kinds-"));

    try {
      await writeFile(join(sourceDir, "mill-cert.pdf"), "pdf-content");

      const library = await createLibrary(fs, tempRoot, "Kinds Test");
      const material = await createMaterial(library, { fields: { family: "aluminum" } });
      await attachFiles(library, material.id, [
        { sourcePath: join(sourceDir, "mill-cert.pdf"), kindKey: "mtr" },
      ]);

      const reopened = await openLibrary(fs, library.paths.root);
      expect(await listMaterialAttachments(reopened, material.id)).toEqual([
        { name: "mill-cert.pdf", format: "pdf", kindKey: "mtr" },
      ]);

      await renameMaterialAttachment(reopened, material.id, "mill-cert.pdf", "heat-cert.pdf");
      expect(await listMaterialAttachments(reopened, material.id)).toEqual([
        { name: "heat-cert.pdf", format: "pdf", kindKey: "mtr" },
      ]);

      await removeMaterialAttachment(reopened, material.id, "heat-cert.pdf");
      expect(await listMaterialAttachments(reopened, material.id)).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  it("rejects attachment kinds that are not configured in the library", async () => {
    const fs = createNodeFileSystem();
    const tempRoot = await mkdtemp(join(tmpdir(), "certtrace-attachments-unknown-kind-"));
    const sourceDir = await mkdtemp(join(tmpdir(), "certtrace-source-unknown-kind-"));

    try {
      await writeFile(join(sourceDir, "cert.pdf"), "pdf-content");
      const library = await createLibrary(fs, tempRoot, "Unknown Kind Test");
      const material = await createMaterial(library, { fields: { family: "aluminum" } });

      await expect(
        attachFiles(library, material.id, [
          { sourcePath: join(sourceDir, "cert.pdf"), kindKey: "deleted_kind" },
        ]),
      ).rejects.toThrow("Unknown attachment kind: deleted_kind");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  it("clears assignments when an attachment kind is removed", async () => {
    const fs = createNodeFileSystem();
    const tempRoot = await mkdtemp(join(tmpdir(), "certtrace-attachments-remove-kind-"));
    const sourceDir = await mkdtemp(join(tmpdir(), "certtrace-source-remove-kind-"));

    try {
      await writeFile(join(sourceDir, "cert.pdf"), "pdf-content");
      const library = await createLibrary(fs, tempRoot, "Remove Kind Test");
      const material = await createMaterial(library, { fields: { family: "aluminum" } });
      await attachFiles(library, material.id, [
        { sourcePath: join(sourceDir, "cert.pdf"), kindKey: "mtr" },
      ]);

      await updateFieldSchema(library, {
        ...library.fieldSchema,
        attachmentKinds: library.fieldSchema.attachmentKinds.filter((kind) => kind.key !== "mtr"),
      });
      await updateFieldSchema(library, {
        ...library.fieldSchema,
        attachmentKinds: [...library.fieldSchema.attachmentKinds, { key: "mtr", label: "MTR" }],
      });

      expect(await listMaterialAttachments(library, material.id)).toEqual([
        { name: "cert.pdf", format: "pdf" },
      ]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  it("rolls back copied files when kind metadata cannot be saved", async () => {
    const fs = createNodeFileSystem();
    const tempRoot = await mkdtemp(join(tmpdir(), "certtrace-attachments-rollback-"));
    const sourceDir = await mkdtemp(join(tmpdir(), "certtrace-source-rollback-"));

    try {
      await writeFile(join(sourceDir, "cert.pdf"), "pdf-content");
      const library = await createLibrary(fs, tempRoot, "Rollback Test");
      const material = await createMaterial(library, { fields: { family: "aluminum" } });
      const writeFileNormally = library.fs.writeFile.bind(library.fs);
      library.fs.writeFile = async (path, content) => {
        if (path.endsWith(".attachments.json")) {
          throw new Error("metadata unavailable");
        }
        await writeFileNormally(path, content);
      };

      await expect(
        attachFiles(library, material.id, [
          { sourcePath: join(sourceDir, "cert.pdf"), kindKey: "mtr" },
        ]),
      ).rejects.toThrow("metadata unavailable");
      expect(await listMaterialAttachments(library, material.id)).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(sourceDir, { recursive: true, force: true });
    }
  });
});
