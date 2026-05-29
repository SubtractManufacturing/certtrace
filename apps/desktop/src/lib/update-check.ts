export const APP_VERSION = "0.0.0";
const RELEASES_URL = "https://api.github.com/repos/SubtractManufacturing/certtrace/releases/latest";

export interface UpdateInfo {
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

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

export async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  const response = await fetch(RELEASES_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) {
    throw new Error(`Update check failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
    body?: string;
  };

  const latestVersion = payload.tag_name?.replace(/^v/, "") ?? "";
  const releaseUrl = payload.html_url ?? "";
  const releaseNotes = payload.body ?? "";

  if (!latestVersion || !releaseUrl) {
    throw new Error("Update check returned an invalid release payload");
  }

  if (!isNewerVersion(latestVersion, APP_VERSION)) {
    return null;
  }

  return { latestVersion, releaseUrl, releaseNotes };
}
