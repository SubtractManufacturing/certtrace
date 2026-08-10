import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { jobAssignmentsPath } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  archiveMaterial,
  assignMaterialToJob,
  createJob,
  createLibrary,
  createMaterial,
  listJobsForMaterial,
  listMaterialsForJob,
  openLibrary,
  removeJob,
  removeMaterial,
  unassignMaterialFromJob,
} from "../src/index.js";

describe("job assignments", () => {
  it("assigns and lists Materials for a Job, persisting across reopen", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-assign-"));

    try {
      const library = await createLibrary(fs, parentDir, "Assign Shop");
      const job = await createJob(library, {
        jobNumber: "JO-1001",
        jobDate: "2026-08-10",
      });
      const material = await createMaterial(library, {
        fields: { family: "aluminum" },
      });

      await assignMaterialToJob(library, job.id, material.id);

      const linked = await listMaterialsForJob(library, job.id);
      expect(linked.map((entry) => entry.id)).toEqual([material.id]);

      const onDisk = JSON.parse(
        await readFile(join(library.paths.root, jobAssignmentsPath(job.id)), "utf8"),
      );
      expect(onDisk.materialIds).toEqual([material.id]);

      const reopened = await openLibrary(fs, library.paths.root);
      expect((await listMaterialsForJob(reopened, job.id)).map((entry) => entry.id)).toEqual([
        material.id,
      ]);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("unassigns from either side and lists Jobs for a Material", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-assign-"));

    try {
      const library = await createLibrary(fs, parentDir, "Unassign Shop");
      const job = await createJob(library, { jobNumber: "JO-2001", jobDate: "2026-08-10" });
      const material = await createMaterial(library, { fields: { family: "aluminum" } });

      await assignMaterialToJob(library, job.id, material.id);
      expect((await listJobsForMaterial(library, material.id)).map((entry) => entry.id)).toEqual([
        job.id,
      ]);

      await unassignMaterialFromJob(library, job.id, material.id);
      expect(await listMaterialsForJob(library, job.id)).toEqual([]);
      expect(await listJobsForMaterial(library, material.id)).toEqual([]);
      await expect(
        readFile(join(library.paths.root, jobAssignmentsPath(job.id)), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("allows assigning Archived Materials and keeps the assignment after archive", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-assign-"));

    try {
      const library = await createLibrary(fs, parentDir, "Archive Assign Shop");
      const job = await createJob(library, { jobNumber: "JO-3001", jobDate: "2026-08-10" });
      const material = await createMaterial(library, { fields: { family: "aluminum" } });

      await assignMaterialToJob(library, job.id, material.id);
      await archiveMaterial(library, material.id);

      const linkedAfterArchive = await listMaterialsForJob(library, job.id);
      expect(linkedAfterArchive).toHaveLength(1);
      expect(linkedAfterArchive[0]?.id).toBe(material.id);
      expect(linkedAfterArchive[0]?.archived).toBe(true);

      const archived = await createMaterial(library, { fields: { family: "steel" } });
      await archiveMaterial(library, archived.id);
      await assignMaterialToJob(library, job.id, archived.id);

      expect((await listMaterialsForJob(library, job.id)).map((entry) => entry.id).sort()).toEqual(
        [archived.id, material.id].sort(),
      );
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("cascades Job assignments when a Job or Material is deleted", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-assign-"));

    try {
      const library = await createLibrary(fs, parentDir, "Cascade Shop");
      const jobA = await createJob(library, { jobNumber: "JO-A", jobDate: "2026-08-10" });
      const jobB = await createJob(library, { jobNumber: "JO-B", jobDate: "2026-08-11" });
      const material = await createMaterial(library, { fields: { family: "aluminum" } });
      const other = await createMaterial(library, { fields: { family: "steel" } });

      await assignMaterialToJob(library, jobA.id, material.id);
      await assignMaterialToJob(library, jobA.id, other.id);
      await assignMaterialToJob(library, jobB.id, material.id);

      await removeJob(library, jobA.id);
      expect((await listJobsForMaterial(library, material.id)).map((entry) => entry.id)).toEqual([
        jobB.id,
      ]);
      expect(await listJobsForMaterial(library, other.id)).toEqual([]);

      await removeMaterial(library, material.id);
      expect(await listMaterialsForJob(library, jobB.id)).toEqual([]);

      await assignMaterialToJob(library, jobB.id, other.id);
      await removeMaterial(library, other.id);
      expect(await listMaterialsForJob(library, jobB.id)).toEqual([]);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
