import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { checkForUpdates as checkGithubRelease, type UpdateInfo } from "./update-check";

export type UpdateInstallState = "idle" | "downloading" | "installing";

export interface AvailableUpdate extends UpdateInfo {
  /** Present when the Tauri updater can install in-app. */
  updater?: Update;
}

const RELEASE_TAG_PREFIX = "desktop-v";

export type AppUpdateCheckResult =
  | { status: "available"; info: AvailableUpdate }
  | { status: "current" }
  | { status: "no-releases" }
  /** Newer release exists on GitHub, but this platform's updater artifacts are not ready. */
  | { status: "pending-artifacts"; reason: string };

async function enrichWithGithubMetadata(info: AvailableUpdate): Promise<AvailableUpdate> {
  try {
    const github = await checkGithubRelease();
    if (github.status !== "available") {
      return info;
    }

    if (github.info.latestVersion !== info.latestVersion) {
      return info;
    }

    return {
      ...info,
      releaseNotes: github.info.releaseNotes || info.releaseNotes,
      releaseUrl: github.info.releaseUrl || info.releaseUrl,
    };
  } catch {
    return info;
  }
}

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  try {
    const update = await check();
    if (!update) {
      return { status: "current" };
    }

    const info: AvailableUpdate = {
      latestVersion: update.version,
      releaseNotes: update.body ?? "",
      releaseUrl: `https://github.com/SubtractManufacturing/certtrace/releases/tag/${RELEASE_TAG_PREFIX}${update.version}`,
      updater: update,
    };

    return {
      status: "available",
      info: await enrichWithGithubMetadata(info),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Tauri updater check failed:", reason);

    // Only advertise an update when the Tauri updater can install it for this
    // platform. During multi-platform releases, latest.json may list a newer
    // version before this OS's artifacts are uploaded.
    try {
      const github = await checkGithubRelease();
      if (github.status === "available") {
        return { status: "pending-artifacts", reason };
      }
      if (github.status === "no-releases") {
        return github;
      }
      return { status: "current" };
    } catch {
      return { status: "current" };
    }
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
