import { isNotFoundError } from "@certtrace/file-storage";
import {
  type JobMetadataV1,
  jobAssignmentsPath,
  joinPath,
  type MaterialMetadataV1,
  materialMetadataPath,
  SCHEMA_VERSION,
} from "@certtrace/types";
import { LibraryError } from "./errors.js";
import { getJob, listJobIds, listJobs } from "./jobs.js";
import { migrateMaterialMetadata } from "./migrations/index.js";
import type { OpenLibraryResult } from "./types.js";

interface JobAssignmentsFile {
  version: typeof SCHEMA_VERSION;
  materialIds: string[];
}

async function writeJson(library: OpenLibraryResult, path: string, value: unknown): Promise<void> {
  await library.fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function emptyAssignments(): JobAssignmentsFile {
  return { version: SCHEMA_VERSION, materialIds: [] };
}

async function readMaterialMetadata(
  library: OpenLibraryResult,
  materialId: string,
): Promise<MaterialMetadataV1> {
  const metadataPath = joinPath(library.paths.root, materialMetadataPath(materialId));
  let raw: string;
  try {
    raw = await library.fs.readFile(metadataPath);
  } catch {
    throw new LibraryError(`Missing Material metadata at ${metadataPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LibraryError(`Invalid JSON in Material metadata at ${metadataPath}`);
  }

  try {
    return migrateMaterialMetadata(parsed);
  } catch (error) {
    throw new LibraryError(`Invalid Material metadata at ${metadataPath}: ${String(error)}`);
  }
}

async function readJobAssignments(
  library: OpenLibraryResult,
  jobId: string,
): Promise<JobAssignmentsFile> {
  const path = joinPath(library.paths.root, jobAssignmentsPath(jobId));
  let raw: string;
  try {
    raw = await library.fs.readFile(path);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return emptyAssignments();
    }
    throw new LibraryError(`Unable to read Job assignments at ${path}: ${String(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LibraryError(`Invalid JSON in Job assignments at ${path}`);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as JobAssignmentsFile).version !== SCHEMA_VERSION ||
    !Array.isArray((parsed as JobAssignmentsFile).materialIds) ||
    !(parsed as JobAssignmentsFile).materialIds.every((id) => typeof id === "string")
  ) {
    throw new LibraryError(`Invalid Job assignments at ${path}`);
  }

  return {
    version: SCHEMA_VERSION,
    materialIds: [...new Set((parsed as JobAssignmentsFile).materialIds)].sort(),
  };
}

async function writeJobAssignments(
  library: OpenLibraryResult,
  jobId: string,
  materialIds: string[],
): Promise<void> {
  const path = joinPath(library.paths.root, jobAssignmentsPath(jobId));
  const uniqueSorted = [...new Set(materialIds)].sort();
  if (uniqueSorted.length === 0) {
    try {
      await library.fs.remove(path);
    } catch (error: unknown) {
      if (!isNotFoundError(error)) {
        throw new LibraryError(`Unable to clear Job assignments at ${path}: ${String(error)}`);
      }
    }
    return;
  }

  await writeJson(library, path, {
    version: SCHEMA_VERSION,
    materialIds: uniqueSorted,
  } satisfies JobAssignmentsFile);
}

/** Assign a Material to a Job (idempotent). Archived Materials are allowed. */
export async function assignMaterialToJob(
  library: OpenLibraryResult,
  jobId: string,
  materialId: string,
): Promise<void> {
  await getJob(library, jobId);
  await readMaterialMetadata(library, materialId);

  const current = await readJobAssignments(library, jobId);
  if (current.materialIds.includes(materialId)) {
    return;
  }
  await writeJobAssignments(library, jobId, [...current.materialIds, materialId]);
}

/** Remove a Job assignment (idempotent). */
export async function unassignMaterialFromJob(
  library: OpenLibraryResult,
  jobId: string,
  materialId: string,
): Promise<void> {
  await getJob(library, jobId);
  const current = await readJobAssignments(library, jobId);
  if (!current.materialIds.includes(materialId)) {
    return;
  }
  await writeJobAssignments(
    library,
    jobId,
    current.materialIds.filter((id) => id !== materialId),
  );
}

/** Material ids historically assigned to a Job (raw sidecar contents). */
export async function listAssignedMaterialIds(
  library: OpenLibraryResult,
  jobId: string,
): Promise<string[]> {
  await getJob(library, jobId);
  return (await readJobAssignments(library, jobId)).materialIds;
}

/** Materials historically assigned to a Job (includes Archived). */
export async function listMaterialsForJob(
  library: OpenLibraryResult,
  jobId: string,
): Promise<MaterialMetadataV1[]> {
  const materials: MaterialMetadataV1[] = [];
  for (const materialId of await listAssignedMaterialIds(library, jobId)) {
    try {
      materials.push(await readMaterialMetadata(library, materialId));
    } catch {
      // Skip dangling ids left by partial deletes or hand-edited libraries.
    }
  }
  return materials;
}

/** Jobs that historically reference a Material. */
export async function listJobsForMaterial(
  library: OpenLibraryResult,
  materialId: string,
): Promise<JobMetadataV1[]> {
  await readMaterialMetadata(library, materialId);

  const matched: JobMetadataV1[] = [];
  for (const job of await listJobs(library)) {
    const assignments = await readJobAssignments(library, job.id);
    if (assignments.materialIds.includes(materialId)) {
      matched.push(job);
    }
  }
  return matched;
}

/** Drop a Material from every Job assignment file (used by Material delete cascade). */
export async function removeMaterialFromAllJobAssignments(
  library: OpenLibraryResult,
  materialId: string,
): Promise<void> {
  for (const jobId of await listJobIds(library)) {
    const current = await readJobAssignments(library, jobId);
    if (!current.materialIds.includes(materialId)) {
      continue;
    }
    await writeJobAssignments(
      library,
      jobId,
      current.materialIds.filter((id) => id !== materialId),
    );
  }
}
