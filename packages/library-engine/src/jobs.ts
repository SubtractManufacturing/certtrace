import { isNotFoundError } from "@certtrace/file-storage";
import {
  type JobMetadataV1,
  jobMetadataPath,
  jobMetadataV1Schema,
  joinPath,
  SCHEMA_VERSION,
} from "@certtrace/types";
import { LibraryError } from "./errors.js";
import type { CreateJobInput, OpenLibraryResult, UpdateJobInput } from "./types.js";

const METADATA_FILENAME = "metadata.json";

function normalizeJobNumberKey(jobNumber: string): string {
  return jobNumber.trim().toLowerCase();
}

function optionalTrimmedText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function generateJobId(existingIds: Set<string>): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `job_${crypto.randomUUID().replace(/-/g, "")}`;
    if (!existingIds.has(id)) {
      return id;
    }
  }
  throw new LibraryError("Unable to allocate a unique Job id");
}

async function writeJson(library: OpenLibraryResult, path: string, value: unknown): Promise<void> {
  await library.fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function ensureJobsDir(library: OpenLibraryResult): Promise<void> {
  await library.fs.mkdir(library.paths.jobs, { recursive: true });
}

async function readJobMetadata(library: OpenLibraryResult, jobId: string): Promise<JobMetadataV1> {
  const metadataPath = joinPath(library.paths.root, jobMetadataPath(jobId));
  let raw: string;
  try {
    raw = await library.fs.readFile(metadataPath);
  } catch {
    throw new LibraryError(`Missing Job metadata at ${metadataPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LibraryError(`Invalid JSON in Job metadata at ${metadataPath}`);
  }

  try {
    return jobMetadataV1Schema.parse(parsed);
  } catch (error) {
    throw new LibraryError(`Invalid Job metadata at ${metadataPath}: ${String(error)}`);
  }
}

export async function listJobIds(library: OpenLibraryResult): Promise<string[]> {
  try {
    const entries = await library.fs.readdir(library.paths.jobs);
    return entries
      .filter((entry) => entry.isDirectory)
      .map((entry) => entry.name)
      .sort();
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw new LibraryError(`Unable to list jobs in ${library.paths.jobs}: ${String(error)}`);
  }
}

export async function listJobs(library: OpenLibraryResult): Promise<JobMetadataV1[]> {
  const ids = await listJobIds(library);
  const jobs: JobMetadataV1[] = [];
  for (const id of ids) {
    jobs.push(await readJobMetadata(library, id));
  }
  return jobs.sort((a, b) => {
    const byDate = b.jobDate.localeCompare(a.jobDate);
    if (byDate !== 0) {
      return byDate;
    }
    return a.jobNumber.localeCompare(b.jobNumber, undefined, { sensitivity: "base" });
  });
}

export async function getJob(library: OpenLibraryResult, jobId: string): Promise<JobMetadataV1> {
  return readJobMetadata(library, jobId);
}

async function assertUniqueJobNumber(
  library: OpenLibraryResult,
  jobNumber: string,
  exceptJobId?: string,
): Promise<void> {
  const key = normalizeJobNumberKey(jobNumber);
  for (const job of await listJobs(library)) {
    if (exceptJobId && job.id === exceptJobId) {
      continue;
    }
    if (normalizeJobNumberKey(job.jobNumber) === key) {
      throw new LibraryError(
        `A Job with number "${job.jobNumber}" already exists in this library.`,
      );
    }
  }
}

export async function createJob(
  library: OpenLibraryResult,
  input: CreateJobInput,
): Promise<JobMetadataV1> {
  const jobNumber = input.jobNumber.trim();
  if (!jobNumber) {
    throw new LibraryError("Job number is required.");
  }
  const jobDate = input.jobDate.trim();
  if (!jobDate) {
    throw new LibraryError("Job date is required.");
  }

  await ensureJobsDir(library);
  await assertUniqueJobNumber(library, jobNumber);

  const existingIds = new Set(await listJobIds(library));
  const id = generateJobId(existingIds);
  const now = new Date().toISOString();
  let metadata: JobMetadataV1;
  try {
    metadata = jobMetadataV1Schema.parse({
      version: SCHEMA_VERSION,
      id,
      jobNumber,
      jobDate,
      customer: optionalTrimmedText(input.customer),
      notes: optionalTrimmedText(input.notes),
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    throw new LibraryError(`Invalid Job: ${String(error)}`);
  }

  const jobDirPath = joinPath(library.paths.jobs, id);
  await library.fs.mkdir(jobDirPath, { recursive: true });
  await writeJson(library, joinPath(jobDirPath, METADATA_FILENAME), metadata);
  return metadata;
}

export async function updateJob(
  library: OpenLibraryResult,
  jobId: string,
  input: UpdateJobInput,
): Promise<JobMetadataV1> {
  const current = await getJob(library, jobId);

  const nextJobNumber = input.jobNumber !== undefined ? input.jobNumber.trim() : current.jobNumber;
  if (!nextJobNumber) {
    throw new LibraryError("Job number is required.");
  }

  const nextJobDate = input.jobDate !== undefined ? input.jobDate.trim() : current.jobDate;
  if (!nextJobDate) {
    throw new LibraryError("Job date is required.");
  }

  if (normalizeJobNumberKey(nextJobNumber) !== normalizeJobNumberKey(current.jobNumber)) {
    await assertUniqueJobNumber(library, nextJobNumber, jobId);
  }

  let updated: JobMetadataV1;
  try {
    updated = jobMetadataV1Schema.parse({
      ...current,
      jobNumber: nextJobNumber,
      jobDate: nextJobDate,
      customer:
        input.customer !== undefined ? optionalTrimmedText(input.customer) : current.customer,
      notes: input.notes !== undefined ? optionalTrimmedText(input.notes) : current.notes,
      id: current.id,
      version: current.version,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new LibraryError(`Invalid Job: ${String(error)}`);
  }

  const metadataPath = joinPath(library.paths.root, jobMetadataPath(jobId));
  await writeJson(library, metadataPath, updated);
  return updated;
}

export async function removeJob(library: OpenLibraryResult, jobId: string): Promise<void> {
  await getJob(library, jobId);
  await library.fs.remove(joinPath(library.paths.jobs, jobId));
}

/** Distinct non-empty Job customer strings in the Library (as stored), sorted. */
export async function listJobCustomers(library: OpenLibraryResult): Promise<string[]> {
  const customers = new Set<string>();
  for (const job of await listJobs(library)) {
    if (job.customer) {
      customers.add(job.customer);
    }
  }
  return [...customers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Find Jobs matching the query against number, customer, or notes (case-insensitive). Empty query returns all. */
export function filterJobs(jobs: JobMetadataV1[], query: string): JobMetadataV1[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return jobs;
  }
  return jobs.filter((job) => {
    const haystacks = [job.jobNumber, job.customer ?? "", job.notes ?? ""];
    return haystacks.some((value) => value.toLowerCase().includes(needle));
  });
}

