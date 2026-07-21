import type { Update } from "@tauri-apps/plugin-updater";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkMock, relaunchMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  relaunchMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: relaunchMock,
}));

import {
  canInstallInApp,
  checkForAppUpdate,
  installAvailableUpdate,
  isReleaseReady,
} from "./update-client";

describe("isReleaseReady", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("returns false when the release is younger than 30 minutes", () => {
    expect(isReleaseReady("2026-07-21T11:45:00.000Z", now)).toBe(false);
  });

  it("returns true when the release is at least 30 minutes old", () => {
    expect(isReleaseReady("2026-07-21T11:30:00.000Z", now)).toBe(true);
  });

  it("returns false when the publish date is missing or invalid", () => {
    expect(isReleaseReady(undefined, now)).toBe(false);
    expect(isReleaseReady("not-a-date", now)).toBe(false);
  });
});

describe("checkForAppUpdate", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  beforeEach(() => {
    checkMock.mockReset();
    relaunchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns available when Tauri finds a ready newer build", async () => {
    const updater = {
      version: "1.0.1",
      body: "Bug fixes",
      date: "2026-07-21T11:00:00.000Z",
      downloadAndInstall: vi.fn(),
    } as unknown as Update;

    checkMock.mockResolvedValue(updater);

    await expect(checkForAppUpdate(now)).resolves.toEqual({
      status: "available",
      info: {
        latestVersion: "1.0.1",
        releaseNotes: "Bug fixes",
        updater,
      },
    });
  });

  it("returns current when the Tauri updater finds no update", async () => {
    checkMock.mockResolvedValue(null);

    await expect(checkForAppUpdate(now)).resolves.toEqual({ status: "current" });
  });

  it("returns current when a newer build is within the age gate", async () => {
    const updater = {
      version: "1.0.6",
      body: "Still publishing",
      date: "2026-07-21T11:45:00.000Z",
      downloadAndInstall: vi.fn(),
    } as unknown as Update;

    checkMock.mockResolvedValue(updater);

    await expect(checkForAppUpdate(now)).resolves.toEqual({ status: "current" });
  });

  it("returns current when the Tauri updater cannot install for this platform", async () => {
    checkMock.mockRejectedValue(new Error("Could not find platform darwin-aarch64"));

    await expect(checkForAppUpdate(now)).resolves.toEqual({ status: "current" });
  });
});

describe("installAvailableUpdate", () => {
  it("downloads, installs, and relaunches", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const updater = { downloadAndInstall } as unknown as Update;

    await installAvailableUpdate(updater);

    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(relaunchMock).toHaveBeenCalledOnce();
  });
});

describe("canInstallInApp", () => {
  it("returns true when updater handle is present", () => {
    const updater = {} as Update;
    expect(
      canInstallInApp({
        latestVersion: "1.0.1",
        releaseNotes: "",
        updater,
      }),
    ).toBe(true);
  });
});
