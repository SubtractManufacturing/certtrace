import type { OpenLibraryResult } from "@certtrace/library-engine";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chooseSelectOption } from "../test/select-helpers";
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
  printLabelPdf: vi.fn(),
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
    vi.mocked(fetchMaterialAttachments).mockResolvedValue([
      { name: "cert.pdf", format: "pdf", kindKey: "mtr" },
    ]);
  });

  it("assigns a kind per file and supports rename, delete, and reveal in folder", async () => {
    vi.mocked(pickAttachmentFiles).mockResolvedValue(["/incoming/coc.pdf"]);

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

    await userEvent.click(screen.getByRole("button", { name: /Add attachments/i }));
    await chooseSelectOption(screen.getByLabelText("Type for coc.pdf"), "COC");
    await userEvent.click(screen.getByRole("button", { name: /Attach files/i }));

    expect(attachFilesToMaterial).toHaveBeenCalledWith(library, material.id, [
      { sourcePath: "/incoming/coc.pdf", kindKey: "coc" },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Rename cert.pdf" }));
    const renameInput = screen.getByLabelText("Filename");
    await userEvent.clear(renameInput);
    await userEvent.type(renameInput, "renamed-cert.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(renameAttachment).toHaveBeenCalledWith(
      library,
      material.id,
      "cert.pdf",
      "renamed-cert.pdf",
    );

    await userEvent.click(screen.getByRole("button", { name: "Show cert.pdf in folder" }));
    expect(revealAttachmentInFolder).toHaveBeenCalledWith(library, material.id, "cert.pdf");

    await userEvent.click(screen.getByRole("button", { name: "Delete cert.pdf" }));
    await waitFor(() =>
      expect(deleteAttachment).toHaveBeenCalledWith(library, material.id, "cert.pdf"),
    );
  });
});
