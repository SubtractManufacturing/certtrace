import type { OpenLibraryResult } from "@certtrace/library-engine";
import { createLabelContentItem, defaultFieldSchemaV1 } from "@certtrace/types";
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
import { printLabelPdf, saveLabelPdfViaDialog } from "../lib/label-client";
import {
  archiveMaterial,
  assignMaterialToJob,
  fetchJobs,
  fetchJobsForMaterial,
  fetchMaterialAttachments,
  unarchiveMaterial,
  unassignMaterialFromJob,
} from "../lib/library-client";
import { chooseSelectOption } from "../test/select-helpers";
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
  archiveMaterial: vi.fn(),
  assignMaterialToJob: vi.fn(),
  deleteMaterial: vi.fn(),
  fetchJobs: vi.fn(async () => []),
  fetchJobsForMaterial: vi.fn(async () => []),
  fetchMaterialAttachments: vi.fn(),
  unarchiveMaterial: vi.fn(),
  unassignMaterialFromJob: vi.fn(),
  updateMaterialMetadata: vi.fn(),
}));

vi.mock("../lib/label-client", () => ({
  generateLibraryLabelPdf: vi.fn(async () => ({ pdf: new Uint8Array([1]), warnings: [] })),
  generateLibraryLabelPdfBytes: vi.fn(async () => new Uint8Array()),
  getDefaultLabelTemplate: vi.fn((lib: OpenLibraryResult) =>
    lib.config.labelTemplates.find((t) => t.id === lib.config.defaultLabelTemplateId),
  ),
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
  config: {
    version: 3,
    name: "Main",
    idStrategy: "numeric",
    labelTemplates: [
      {
        id: "starter-4x6",
        name: "4×6 in",
        size: { kind: "catalog", catalogId: "4x6" },
        displayUnit: "in",
        content: ["material_id", "qr"].map((key) => createLabelContentItem(key)),
      },
    ],
    defaultLabelTemplateId: "starter-4x6",
    searchAllFields: false,
  },
} as OpenLibraryResult;

const material = {
  version: 3 as const,
  id: "AL-falcon-101",
  fields: {},
  identifiers: {},
  archived: false,
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

const sampleJob = {
  version: 3 as const,
  id: "job_1",
  jobNumber: "JO-1001",
  jobDate: "2026-08-10",
  customer: "Acme",
  createdAt: "2026-08-10T12:00:00.000Z",
  updatedAt: "2026-08-10T12:00:00.000Z",
};

describe("MaterialDetailPanel attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMaterialAttachments).mockResolvedValue([
      { name: "cert.pdf", format: "pdf", kindKey: "mtr" },
    ]);
    vi.mocked(fetchJobsForMaterial).mockResolvedValue([]);
    vi.mocked(fetchJobs).mockResolvedValue([]);
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
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    expect(await screen.findByText("MTR · PDF")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Add attachments/i }));
    await chooseSelectOption(await screen.findByLabelText("Type for coc.pdf"), "COC");
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

describe("MaterialDetailPanel job assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMaterialAttachments).mockResolvedValue([]);
    vi.mocked(fetchJobsForMaterial).mockResolvedValue([]);
    vi.mocked(fetchJobs).mockResolvedValue([sampleJob]);
    vi.mocked(assignMaterialToJob).mockResolvedValue(undefined);
    vi.mocked(unassignMaterialFromJob).mockResolvedValue(undefined);
  });

  it("assigns and unassigns jobs with unlink confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchJobsForMaterial)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sampleJob])
      .mockResolvedValueOnce([]);

    render(
      <MaterialDetailPanel
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={() => undefined}
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    expect(await screen.findByText("Jobs")).toBeTruthy();
    const assignSelect = await waitFor(() => {
      const combobox = screen.getByLabelText("Assign job");
      expect((combobox as HTMLButtonElement).disabled).toBe(false);
      return combobox;
    });
    await chooseSelectOption(assignSelect, /JO-1001/);
    await user.click(screen.getByRole("button", { name: /^assign$/i }));

    await waitFor(() => {
      expect(assignMaterialToJob).toHaveBeenCalledWith(library, "job_1", material.id);
    });
    expect(await screen.findByText("JO-1001")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^unlink$/i }));
    expect(screen.getByRole("heading", { name: /unlink material from job/i })).toBeTruthy();
    const unlinkButtons = screen.getAllByRole("button", { name: /^unlink$/i });
    await user.click(unlinkButtons[unlinkButtons.length - 1]!);

    await waitFor(() => {
      expect(unassignMaterialFromJob).toHaveBeenCalledWith(library, "job_1", material.id);
    });
  });

  it("warns with affected job numbers when deleting a linked material", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchJobsForMaterial).mockResolvedValue([sampleJob]);

    render(
      <MaterialDetailPanel
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={() => undefined}
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    expect(await screen.findByText("JO-1001")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /delete material/i }));
    await waitFor(() => {
      expect(vi.mocked(fetchJobsForMaterial).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(await screen.findByText(/Jobs that will lose this assignment/i)).toBeTruthy();
    expect(screen.getAllByText("JO-1001").length).toBeGreaterThanOrEqual(2);
  });
});

describe("MaterialDetailPanel label preview hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMaterialAttachments).mockResolvedValue([]);
    vi.mocked(fetchJobsForMaterial).mockResolvedValue([]);
    vi.mocked(fetchJobs).mockResolvedValue([]);
  });

  it("opens the Label preview from Print without printing from detail", async () => {
    render(
      <MaterialDetailPanel
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={() => undefined}
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Print label/i }));

    expect(await screen.findByRole("heading", { name: /Label preview/i })).toBeTruthy();
    expect(printLabelPdf).not.toHaveBeenCalled();
  });

  it("opens the Label preview from Export without saving from detail", async () => {
    render(
      <MaterialDetailPanel
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={() => undefined}
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Export label PDF/i }));

    expect(await screen.findByRole("heading", { name: /Label preview/i })).toBeTruthy();
    expect(saveLabelPdfViaDialog).not.toHaveBeenCalled();
  });

  it("archives a material after confirmation", async () => {
    const onMaterialUpdated = vi.fn();
    vi.mocked(archiveMaterial).mockResolvedValue({ ...material, archived: true });

    render(
      <MaterialDetailPanel
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={onMaterialUpdated}
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Archive$/i }));
    expect(screen.getByRole("heading", { name: /Archive material AL-falcon-101/i })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Archive material$/i }));

    await waitFor(() => expect(archiveMaterial).toHaveBeenCalledWith(library, material.id));
    expect(onMaterialUpdated).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  it("unarchives a material without confirmation", async () => {
    const onMaterialUpdated = vi.fn();
    vi.mocked(unarchiveMaterial).mockResolvedValue({ ...material, archived: false });

    render(
      <MaterialDetailPanel
        library={library}
        material={{ ...material, archived: true }}
        open
        onOpenChange={() => undefined}
        onMaterialUpdated={onMaterialUpdated}
        onEditLabelTemplates={() => undefined}
        onMaterialDeleted={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Unarchive$/i }));

    await waitFor(() => expect(unarchiveMaterial).toHaveBeenCalledWith(library, material.id));
    expect(onMaterialUpdated).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
    expect(screen.queryByRole("heading", { name: /Archive material/i })).toBeNull();
  });
});
