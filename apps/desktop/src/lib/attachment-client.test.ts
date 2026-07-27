import type { OpenLibraryResult } from "@certtrace/library-engine";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import { revealAttachmentInFolder } from "./attachment-client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("attachment client", () => {
  it("reveals an attachment through the desktop boundary", async () => {
    const library = {
      paths: { materials: "/libraries/main/materials" },
    } as OpenLibraryResult;

    await revealAttachmentInFolder(library, "AL-101", "cert.pdf");

    expect(invoke).toHaveBeenCalledWith("reveal_local_path", {
      path: "/libraries/main/materials/AL-101/cert.pdf",
    });
  });
});
