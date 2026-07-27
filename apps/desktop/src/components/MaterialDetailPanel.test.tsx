import type { OpenLibraryResult } from "@certtrace/library-engine";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachFilesToMaterial,
  deleteAttachment,
  pickAttachmentFiles,
  renameAttachment,
  revealAttachmentInFolder,
} from "../lib/attachment-client";
import { fetchMaterialAttachments } from "../lib/library-client";
import { MaterialDetailPanel } from "./MaterialDetailPanel";

vi.mock("../lib/attachment-client", () => ({
  attachFilesToMaterial: vi.fn(),
  deleteAttachment: vi.fn(),
  pickAttachmentFiles: vi.fn(),
  renameAttachment: vi.fn(),
  revealAttachmentInFolder: vi.fn(),
}));

vi.mock("../lib/library-client", () => ({
  addLibraryFieldOption: vi.fn(),
  fetchMaterialAttachments: vi.fn(),
  updateMaterialMetadata: vi.fn(),
}));

vi.mock("../lib/label-client", () => ({
  generateStandardQrLabelPdfBytes: vi.fn(async () => new Uint8Array()),
  openPathWithOpener: vi.fn(),
  printLabelPdfFromObjectUrl: vi.fn(),
  saveLabelPdfViaDialog: vi.fn(),
}));

const library = {
  paths: {
    root: "/libraries/main",
    materials: "/libraries/main/materials",
  },
  fieldSchema: defaultFieldSchemaV1,
} as OpenLibraryResult;

const material = {
  version: 1 as const,
  id: "AL-falcon-101",
  fields: {},
  identifiers: {},
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

describe("MaterialDetailPanel attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:label"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(fetchMaterialAttachments).mockResolvedValue([
      { name: "cert.pdf", format: "pdf", kindKey: "mtr" },
    ]);
  });

  it("assigns a kind and supports rename, delete, and share", async () => {
    vi.mocked(pickAttachmentFiles).mockResolvedValue(["/incoming/coc.pdf"]);
    vi.spyOn(window, "prompt").mockReturnValue("renamed-cert.pdf");

    render(
      <MaterialDetailPanel
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={() => undefined}
      />,
    );

    expect(await screen.findByText("MTR · PDF")).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText("Attachment kind"), "coc");
    await userEvent.click(screen.getByRole("button", { name: "Add files" }));
    expect(attachFilesToMaterial).toHaveBeenCalledWith(
      library,
      material.id,
      ["/incoming/coc.pdf"],
      "coc",
    );

    await userEvent.click(screen.getByRole("button", { name: "Rename cert.pdf" }));
    expect(renameAttachment).toHaveBeenCalledWith(
      library,
      material.id,
      "cert.pdf",
      "renamed-cert.pdf",
    );

    await userEvent.click(screen.getByRole("button", { name: "Share cert.pdf" }));
    expect(revealAttachmentInFolder).toHaveBeenCalledWith(library, material.id, "cert.pdf");

    await userEvent.click(screen.getByRole("button", { name: "Delete cert.pdf" }));
    await waitFor(() =>
      expect(deleteAttachment).toHaveBeenCalledWith(library, material.id, "cert.pdf"),
    );
  });
});
