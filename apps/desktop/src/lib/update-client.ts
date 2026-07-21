import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { checkForUpdates as checkGithubRelease, type UpdateInfo } from "./update-check";

export type UpdateInstallState = "idle" | "downloading" | "installing";

export interface AvailableUpdate extends UpdateInfo {
  /** Present when the Tauri updater can install in-app. */
  updater?: Update;
}

export type AppUpdateCheckResult =
  | { status: "available"; info: AvailableUpdate }
  | { status: "current" }
  | { status: "no-releases" };

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
      releaseUrl: `https://github.com/SubtractManufacturing/certtrace/releases/tag/v${update.version}`,
      updater: update,
    };

    return {
      status: "available",
      info: await enrichWithGithubMetadata(info),
    };
  } catch {
    const github = await checkGithubRelease();
    if (github.status === "available") {
      return github;
    }
    if (github.status === "no-releases") {
      return github;
    }
    return github;
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
