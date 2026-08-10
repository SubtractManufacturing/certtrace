import type { OpenLibraryResult } from "@certtrace/library-engine";
import { createLabelContentItem, defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLibraryLabelPdf, printLabelPdf, saveLabelPdfViaDialog } from "../lib/label-client";
import { chooseSelectOption, getSelectValue } from "../test/select-helpers";
import { LabelPreviewDialog } from "./LabelPreviewDialog";

vi.mock("../lib/label-client", () => ({
  generateLibraryLabelPdf: vi.fn(async () => ({ pdf: new Uint8Array([1, 2, 3]), warnings: [] })),
  printLabelPdf: vi.fn(),
  saveLabelPdfViaDialog: vi.fn(async () => "/tmp/label.pdf"),
}));

const letterTemplate = {
  id: "starter-letter",
  name: "8.5×11 in",
  size: { kind: "catalog" as const, catalogId: "letter" as const },
  displayUnit: "in" as const,
  content: ["material_id", "qr"].map((key) => createLabelContentItem(key)),
};

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
        content: ["family", "alloy", "temper", "material_id", "qr"].map((key) =>
          createLabelContentItem(key),
        ),
      },
      letterTemplate,
    ],
    defaultLabelTemplateId: "starter-4x6",
    searchAllFields: false,
  },
} as OpenLibraryResult;

const material = {
  version: 3 as const,
  id: "AL-falcon-101",
  fields: {
    family: "Aluminum",
    alloy: "6061",
    temper: "T6",
  },
  identifiers: {},
  archived: false,
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

describe("LabelPreviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateLibraryLabelPdf).mockResolvedValue({
      pdf: new Uint8Array([1, 2, 3]),
      warnings: [],
    });
  });

  it("opens on the library default Label Template", async () => {
    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onEditTemplates={() => undefined}
      />,
    );

    const templateSelect = await screen.findByLabelText(/Label Template/i);
    expect(getSelectValue(templateSelect)).toBe("starter-4x6");
    expect(await screen.findByText(/Aluminum/i)).toBeTruthy();
  });

  it("lets the user pick another template for this print/export only", async () => {
    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onEditTemplates={() => undefined}
      />,
    );

    const templateSelect = await screen.findByLabelText(/Label Template/i);
    await chooseSelectOption(templateSelect, "8.5×11 in");
    expect(getSelectValue(templateSelect)).toBe("starter-letter");

    await waitFor(() =>
      expect(generateLibraryLabelPdf).toHaveBeenCalledWith(
        library,
        [material],
        expect.objectContaining({ id: "starter-letter" }),
      ),
    );
  });

  it("shows an overflow warning without blocking Print or Save", async () => {
    vi.mocked(generateLibraryLabelPdf).mockResolvedValue({
      pdf: new Uint8Array([1]),
      warnings: ["Label content may not fit the 4×6 in label size."],
    });

    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onEditTemplates={() => undefined}
      />,
    );

    expect(
      await screen.findByText(/Label content may not fit the 4×6 in label size/i),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Print$/i }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: /Save PDF/i }).hasAttribute("disabled")).toBe(false);
  });

  it("prints via the system print path from the preview", async () => {
    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onEditTemplates={() => undefined}
      />,
    );

    await screen.findByLabelText(/Label Template/i);
    await userEvent.click(screen.getByRole("button", { name: /^Print$/i }));

    await waitFor(() =>
      expect(printLabelPdf).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), material.id),
    );
  });

  it("saves a PDF from the preview with the selected template", async () => {
    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onEditTemplates={() => undefined}
      />,
    );

    await screen.findByLabelText(/Label Template/i);
    await userEvent.click(screen.getByRole("button", { name: /Save PDF/i }));

    await waitFor(() =>
      expect(saveLabelPdfViaDialog).toHaveBeenCalledWith(
        library,
        material,
        expect.objectContaining({ id: "starter-4x6" }),
      ),
    );
  });

  it("invokes Edit templates…", async () => {
    const onEditTemplates = vi.fn();
    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={() => undefined}
        onEditTemplates={onEditTemplates}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Edit templates/i }));
    expect(onEditTemplates).toHaveBeenCalledOnce();
  });
});
