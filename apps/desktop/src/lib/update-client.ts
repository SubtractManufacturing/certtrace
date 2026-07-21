import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import type { UpdateInfo } from "./update-check";

export type UpdateInstallState = "idle" | "downloading" | "installing";

export interface AvailableUpdate extends UpdateInfo {
  /** Present when the Tauri updater can install in-app. */
  updater?: Update;
}

const RELEASE_READY_AGE_MS = 30 * 60 * 1000;

/** Hard-coded browser destination — no GitHub API call from the app. */
export const LATEST_RELEASE_PAGE_URL =
  "https://github.com/SubtractManufacturing/certtrace/releases/latest";

export type AppUpdateCheckResult =
  | { status: "available"; info: AvailableUpdate }
  | { status: "current" };

/** True when publish time is known and at least 30 minutes in the past. */
export function isReleaseReady(publishedAt: string | undefined, now: Date = new Date()): boolean {
  if (!publishedAt) {
    return false;
  }
  const publishedMs = Date.parse(publishedAt);
  if (Number.isNaN(publishedMs)) {
    return false;
  }
  return now.getTime() - publishedMs >= RELEASE_READY_AGE_MS;
}

export async function checkForAppUpdate(now: Date = new Date()): Promise<AppUpdateCheckResult> {
  try {
    const update = await check();
    if (!update) {
      return { status: "current" };
    }

    if (!isReleaseReady(update.date, now)) {
      return { status: "current" };
    }

    return {
      status: "available",
      info: {
        latestVersion: update.version,
        releaseNotes: update.body ?? "",
        updater: update,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Tauri updater check failed:", reason);
    return { status: "current" };
  }
}

export async function installAvailableUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}

export function canInstallInApp(
  info: AvailableUpdate,
): info is AvailableUpdate & { updater: Update } {
  return Boolean(info.updater);
}
