import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import { jobMetadataPath } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  createJob,
  createLibrary,
  filterJobs,
  getJob,
  LibraryError,
  listJobCustomers,
  listJobs,
  openLibrary,
  removeJob,
  updateJob,
} from "../src/index.js";

describe("job CRUD", () => {
  it("creates, lists, reads, updates, and deletes a Job", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-"));

    try {
      const library = await createLibrary(fs, parentDir, "Job Shop");
      const created = await createJob(library, {
        jobNumber: "JO-1001",
        jobDate: "2026-08-10",
        customer: "Acme Machining",
        notes: "First article",
      });

      expect(created.jobNumber).toBe("JO-1001");
      expect(created.jobDate).toBe("2026-08-10");
      expect(created.customer).toBe("Acme Machining");
      expect(created.notes).toBe("First article");
      expect(created.id).toMatch(/^[A-Za-z0-9._-]+$/);

      const onDisk = JSON.parse(
        await readFile(join(library.paths.root, jobMetadataPath(created.id)), "utf8"),
      );
      expect(onDisk.jobNumber).toBe("JO-1001");
      expect(onDisk.jobDate).toBe("2026-08-10");

      const listed = await listJobs(await openLibrary(fs, library.paths.root));
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(created.id);

      const fetched = await getJob(library, created.id);
      expect(fetched.customer).toBe("Acme Machining");

      const updated = await updateJob(library, created.id, {
        jobNumber: "JO-1001A",
        customer: "Beta Works",
        notes: "",
      });
      expect(updated.jobNumber).toBe("JO-1001A");
      expect(updated.customer).toBe("Beta Works");
      expect(updated.notes).toBeUndefined();
      expect(updated.jobDate).toBe("2026-08-10");
      expect(updated.updatedAt).not.toBe(created.updatedAt);

      await removeJob(library, created.id);
      expect(await listJobs(await openLibrary(fs, library.paths.root))).toHaveLength(0);
      await expect(getJob(library, created.id)).rejects.toThrow();
      await expect(access(join(library.paths.jobs, created.id))).rejects.toThrow();
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("requires job number and job date, and does not prefill job date", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-"));

    try {
      const library = await createLibrary(fs, parentDir, "Required Fields");

      await expect(createJob(library, { jobNumber: "JO-1", jobDate: "" })).rejects.toBeInstanceOf(
        LibraryError,
      );
      await expect(createJob(library, { jobNumber: "  ", jobDate: "2026-08-10" })).rejects.toBeInstanceOf(
        LibraryError,
      );
      await expect(
        createJob(library, { jobNumber: "JO-1", jobDate: "2026-08-10T00:00:00.000Z" }),
      ).rejects.toBeInstanceOf(LibraryError);

      const created = await createJob(library, {
        jobNumber: "JO-1",
        jobDate: "2026-08-10",
      });
      expect(created.jobDate).toBe("2026-08-10");
      expect(created.customer).toBeUndefined();
      expect(created.notes).toBeUndefined();
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate job numbers after trim and case-insensitive compare", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-"));

    try {
      const library = await createLibrary(fs, parentDir, "Unique Numbers");
      await createJob(library, { jobNumber: "JO-1", jobDate: "2026-08-01" });

      await expect(
        createJob(library, { jobNumber: " jo-1 ", jobDate: "2026-08-02" }),
      ).rejects.toBeInstanceOf(LibraryError);

      const other = await createJob(library, { jobNumber: "JO-2", jobDate: "2026-08-03" });
      await expect(
        updateJob(library, other.id, { jobNumber: "JO-1" }),
      ).rejects.toBeInstanceOf(LibraryError);

      const same = await updateJob(library, other.id, { jobNumber: " jo-2 " });
      expect(same.jobNumber).toBe("jo-2");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("lists distinct job customers and filters jobs by query", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-"));

    try {
      const library = await createLibrary(fs, parentDir, "Customers");
      await createJob(library, {
        jobNumber: "A",
        jobDate: "2026-08-01",
        customer: "Acme Machining",
      });
      await createJob(library, {
        jobNumber: "B",
        jobDate: "2026-08-02",
        customer: "acme machining",
      });
      await createJob(library, {
        jobNumber: "C",
        jobDate: "2026-08-03",
        customer: "Beta Works",
      });
      await createJob(library, { jobNumber: "D", jobDate: "2026-08-04" });

      const customers = await listJobCustomers(library);
      expect(customers).toEqual(["Acme Machining", "Beta Works", "acme machining"]);

      const jobs = await listJobs(library);
      const filtered = filterJobs(jobs, "acme");
      expect(filtered.map((job) => job.jobNumber).sort()).toEqual(["A", "B"]);
      expect(filterJobs(jobs, "  ").map((job) => job.jobNumber).sort()).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
      expect(filterJobs(jobs, "beta").map((job) => job.jobNumber)).toEqual(["C"]);
      expect(filterJobs(jobs, "D").map((job) => job.jobNumber)).toEqual(["D"]);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates jobs folder for legacy libraries that lack it", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-job-"));

    try {
      const library = await createLibrary(fs, parentDir, "Legacy");
      await rm(library.paths.jobs, { recursive: true, force: true });

      const reopened = await openLibrary(fs, library.paths.root);
      const created = await createJob(reopened, {
        jobNumber: "LEG-1",
        jobDate: "2026-08-10",
      });
      expect(created.jobNumber).toBe("LEG-1");
      expect(await listJobs(reopened)).toHaveLength(1);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
