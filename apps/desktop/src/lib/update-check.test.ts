import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdates, isNewerVersion } from "./update-check";

describe("isNewerVersion", () => {
  it("returns true when latest patch is greater", () => {
    expect(isNewerVersion("1.0.1", "1.0.0")).toBe(true);
  });

  it("returns true when latest strips leading v prefix", () => {
    expect(isNewerVersion("v1.0.1", "1.0.0")).toBe(true);
  });

  it("returns true when latest uses desktop-v release tag prefix", () => {
    expect(isNewerVersion("desktop-v1.0.3", "1.0.2")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("v1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when latest is older", () => {
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false);
  });

  it("compares major and minor segments", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(true);
  });

  it("treats missing segments as zero", () => {
    expect(isNewerVersion("1.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.1", "1.0")).toBe(true);
  });

  it("tolerates non-numeric suffix segments by parsing leading digits only", () => {
    expect(isNewerVersion("1.0.0-beta", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.1-beta", "1.0.0")).toBe(true);
  });
});

describe("checkForUpdates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns no-releases when GitHub responds with 404", async () => {
    vi.mocked(fetch).mockResolvedValue({ status: 404 } as Response);

    await expect(checkForUpdates()).resolves.toEqual({ status: "no-releases" });
  });

  it("returns current when latest version is not newer", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: "v0.0.0",
        html_url: "https://github.com/SubtractManufacturing/certtrace/releases/tag/v0.0.0",
        body: "Initial release",
      }),
    } as Response);

    await expect(checkForUpdates()).resolves.toEqual({ status: "current" });
  });

  it("returns available when a newer release exists", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: "v9.9.9",
        html_url: "https://github.com/SubtractManufacturing/certtrace/releases/tag/v9.9.9",
        body: "New features",
      }),
    } as Response);

    await expect(checkForUpdates()).resolves.toEqual({
      status: "available",
      info: {
        latestVersion: "9.9.9",
        releaseUrl: "https://github.com/SubtractManufacturing/certtrace/releases/tag/v9.9.9",
        releaseNotes: "New features",
      },
    });
  });

  it("normalizes desktop-v release tags from GitHub", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: "desktop-v9.9.9",
        html_url: "https://github.com/SubtractManufacturing/certtrace/releases/tag/desktop-v9.9.9",
        body: "New features",
      }),
    } as Response);

    await expect(checkForUpdates()).resolves.toEqual({
      status: "available",
      info: {
        latestVersion: "9.9.9",
        releaseUrl:
          "https://github.com/SubtractManufacturing/certtrace/releases/tag/desktop-v9.9.9",
        releaseNotes: "New features",
      },
    });
  });

  it("throws when GitHub returns an error status", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(checkForUpdates()).rejects.toThrow("Update check failed (503)");
  });
});
