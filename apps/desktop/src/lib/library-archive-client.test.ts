import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { describe, expect, it, vi } from "vitest";
import {
  cancelLibraryArchive,
  listZipEntries,
  onLibraryArchiveProgress,
  readZipEntryText,
  unzipLibraryDir,
  zipLibraryDir,
} from "./library-archive-client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("library-archive-client", () => {
  it("invokes path-based ZIP commands", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([".certtrace/library.json"]);
    await expect(listZipEntries("/tmp/shop.zip")).resolves.toEqual([".certtrace/library.json"]);
    expect(invoke).toHaveBeenCalledWith("list_zip_entries", { zipPath: "/tmp/shop.zip" });

    vi.mocked(invoke).mockResolvedValueOnce('{"name":"Main Shop"}');
    await expect(readZipEntryText("/tmp/shop.zip", ".certtrace/library.json")).resolves.toBe(
      '{"name":"Main Shop"}',
    );

    vi.mocked(invoke).mockResolvedValue(undefined);
    await zipLibraryDir("/tmp/shop", "/tmp/shop.zip", [".certtrace/backups"], [".DS_Store"]);
    expect(invoke).toHaveBeenCalledWith("zip_library_dir", {
      root: "/tmp/shop",
      dest: "/tmp/shop.zip",
      skipPrefixes: [".certtrace/backups"],
      skipNames: [".DS_Store"],
    });

    await unzipLibraryDir("/tmp/shop.zip", "/tmp/copy", "Shop");
    expect(invoke).toHaveBeenCalledWith("unzip_library_dir", {
      zipPath: "/tmp/shop.zip",
      dest: "/tmp/copy",
      stripPrefix: "Shop",
    });

    await cancelLibraryArchive();
    expect(invoke).toHaveBeenCalledWith("cancel_library_archive");
  });

  it("forwards archive progress events", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);
    const handler = vi.fn();

    await expect(onLibraryArchiveProgress(handler)).resolves.toBe(unlisten);
    expect(listen).toHaveBeenCalledWith("library-archive-progress", expect.any(Function));

    const listener = vi.mocked(listen).mock.calls[0]![1] as (event: {
      payload: { current: number; total: number; relativePath: string };
    }) => void;
    listener({ payload: { current: 1, total: 2, relativePath: "README.md" } });
    expect(handler).toHaveBeenCalledWith({ current: 1, total: 2, relativePath: "README.md" });
  });
});
