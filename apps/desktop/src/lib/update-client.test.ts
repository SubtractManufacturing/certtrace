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

import { canInstallInApp, checkForAppUpdate, installAvailableUpdate } from "./update-client";

describe("checkForAppUpdate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    checkMock.mockReset();
    relaunchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns available when the Tauri updater finds a newer build", async () => {
    const updater = {
      version: "1.0.1",
      body: "Bug fixes",
      downloadAndInstall: vi.fn(),
    } as unknown as Update;

    checkMock.mockResolvedValue(updater);

    await expect(checkForAppUpdate()).resolves.toEqual({
      status: "available",
      info: {
        latestVersion: "1.0.1",
        releaseNotes: "Bug fixes",
        releaseUrl: "https://github.com/SubtractManufacturing/certtrace/releases/tag/v1.0.1",
        updater,
      },
    });
  });

  it("returns current when the Tauri updater finds no update", async () => {
    checkMock.mockResolvedValue(null);

    await expect(checkForAppUpdate()).resolves.toEqual({ status: "current" });
  });

  it("falls back to GitHub release metadata when the updater is unavailable", async () => {
    checkMock.mockRejectedValue(new Error("updater unavailable"));
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: "v9.9.9",
        html_url: "https://github.com/SubtractManufacturing/certtrace/releases/tag/v9.9.9",
        body: "Release notes",
      }),
    } as Response);

    await expect(checkForAppUpdate()).resolves.toEqual({
      status: "available",
      info: {
        latestVersion: "9.9.9",
        releaseUrl: "https://github.com/SubtractManufacturing/certtrace/releases/tag/v9.9.9",
        releaseNotes: "Release notes",
      },
    });
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
        releaseUrl: "https://example.com",
        releaseNotes: "",
        updater,
      }),
    ).toBe(true);
  });
});
