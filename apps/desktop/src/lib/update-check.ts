export const APP_VERSION = __APP_VERSION__;
const RELEASES_URL = "https://api.github.com/repos/SubtractManufacturing/certtrace/releases/latest";

export interface UpdateInfo {
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

export type UpdateCheckResult =
  | { status: "available"; info: UpdateInfo }
  | { status: "current" }
  | { status: "no-releases" };

function normalizeReleaseVersion(tagOrVersion: string): string {
  return tagOrVersion.replace(/^desktop-v/, "").replace(/^v/, "");
}

function parseVersion(version: string): number[] {
  return normalizeReleaseVersion(version)
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
  const response = await fetch(RELEASES_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (response.status === 404) {
    return { status: "no-releases" };
  }

  if (!response.ok) {
    throw new Error(`Update check failed (${response.status})`);
  }

  const latest = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
    body?: string;
  };

  const latestVersion = latest.tag_name ? normalizeReleaseVersion(latest.tag_name) : "";
  const releaseUrl = latest.html_url ?? "";
  const releaseNotes = latest.body ?? "";

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
