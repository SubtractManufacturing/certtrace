export const APP_VERSION = "0.0.0";
const RELEASES_URL = "https://api.github.com/repos/SubtractManufacturing/certtrace/releases";

export interface UpdateInfo {
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

export type UpdateCheckResult =
  | { status: "available"; info: UpdateInfo }
  | { status: "current" }
  | { status: "no-releases" };

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);

  for (let index = 0; index < Math.max(latestParts.length, currentParts.length); index += 1) {
    const next = latestParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (next > currentPart) {
      return true;
    }
    if (next < currentPart) {
      return false;
    }
  }

  return false;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const response = await fetch(`${RELEASES_URL}?per_page=1`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (response.status === 404) {
    return { status: "no-releases" };
  }

  if (!response.ok) {
    throw new Error(`Update check failed (${response.status})`);
  }

  const releases = (await response.json()) as Array<{
    tag_name?: string;
    html_url?: string;
    body?: string;
  }>;

  if (releases.length === 0) {
    return { status: "no-releases" };
  }

  const latest = releases[0];
  const latestVersion = latest?.tag_name?.replace(/^v/, "") ?? "";
  const releaseUrl = latest?.html_url ?? "";
  const releaseNotes = latest?.body ?? "";

  if (!latestVersion || !releaseUrl) {
    throw new Error("Update check returned an invalid release payload");
  }

  if (!isNewerVersion(latestVersion, APP_VERSION)) {
    return { status: "current" };
  }

  return {
    status: "available",
    info: { latestVersion, releaseUrl, releaseNotes },
  };
}

/** @deprecated Use checkForUpdates() for richer status handling. */
export async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  const result = await checkForUpdates();
  return result.status === "available" ? result.info : null;
}
