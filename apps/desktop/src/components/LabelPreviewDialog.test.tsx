import type { OpenLibraryResult } from "@certtrace/library-engine";
import {
  type AppSettingsV1,
  createDefaultAppSettingsV1,
  createLabelContentItem,
  defaultFieldSchemaV1,
} from "@certtrace/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrinterSettingsProvider } from "../contexts/PrinterSettingsContext";
import { generateLibraryLabelPdf, printLabelPdf, saveLabelPdfViaDialog } from "../lib/label-client";
import { listOsPrinterQueues } from "../lib/printer-client";
import { chooseSelectOption, getSelectValue } from "../test/select-helpers";
import { LabelPreviewDialog } from "./LabelPreviewDialog";

vi.mock("../lib/label-client", () => ({
  generateLibraryLabelPdf: vi.fn(async () => ({ pdf: new Uint8Array([1, 2, 3]), warnings: [] })),
  printLabelPdf: vi.fn(),
  saveLabelPdfViaDialog: vi.fn(async () => "/tmp/label.pdf"),
}));

vi.mock("../lib/printer-client", () => ({
  listOsPrinterQueues: vi.fn(async () => ["Zebra ZD421"]),
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
    version: 4,
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
} as unknown as OpenLibraryResult;

const material = {
  version: 4 as const,
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

function StatefulPrinterSettings({
  initialSettings,
  children,
}: {
  initialSettings: AppSettingsV1;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  return (
    <PrinterSettingsProvider
      settings={settings}
      onSettingsChange={async (next) => setSettings(next)}
    >
      {children}
    </PrinterSettingsProvider>
  );
}

describe("LabelPreviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateLibraryLabelPdf).mockResolvedValue({
      pdf: new Uint8Array([1, 2, 3]),
      warnings: [],
    });
    vi.mocked(listOsPrinterQueues).mockResolvedValue(["Zebra ZD421"]);
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

  it("shows an overflow warning while Save remains available", async () => {
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
    expect(screen.getByRole("button", { name: /^Print$/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Save PDF/i }).hasAttribute("disabled")).toBe(false);
  });

  it("prints to the assigned available OS queue from the preview", async () => {
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [{ id: "printer-zebra", name: "Rack labels", queueName: "Zebra ZD421" }],
      labelTemplatePrinters: [
        {
          libraryPath: library.paths.root,
          labelTemplateId: "starter-4x6",
          printerId: "printer-zebra",
        },
      ],
    };
    render(
      <PrinterSettingsProvider settings={settings} onSettingsChange={async () => undefined}>
        <LabelPreviewDialog
          library={library}
          material={material}
          open
          onOpenChange={() => undefined}
          onEditTemplates={() => undefined}
        />
      </PrinterSettingsProvider>,
    );

    await screen.findByLabelText(/Label Template/i);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Print$/i }).hasAttribute("disabled")).toBe(false),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Print$/i }));

    await waitFor(() =>
      expect(printLabelPdf).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
        material.id,
        "Zebra ZD421",
        expect.objectContaining({ id: "starter-4x6" }),
      ),
    );
  });

  it("closes the preview after an explicit print succeeds", async () => {
    const onOpenChange = vi.fn();
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [{ id: "printer-zebra", name: "Rack labels", queueName: "Zebra ZD421" }],
      labelTemplatePrinters: [
        {
          libraryPath: library.paths.root,
          labelTemplateId: "starter-4x6",
          printerId: "printer-zebra",
        },
      ],
    };
    render(
      <PrinterSettingsProvider settings={settings} onSettingsChange={async () => undefined}>
        <LabelPreviewDialog
          library={library}
          material={material}
          open
          onOpenChange={onOpenChange}
          onEditTemplates={() => undefined}
        />
      </PrinterSettingsProvider>,
    );

    const printButton = screen.getByRole("button", { name: /^Print$/i });
    await waitFor(() => expect(printButton.hasAttribute("disabled")).toBe(false));
    await userEvent.click(printButton);

    await waitFor(() => expect(printLabelPdf).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not auto-print after manually clearing and reselecting a Printer", async () => {
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [{ id: "printer-zebra", name: "Rack labels", queueName: "Zebra ZD421" }],
      labelTemplatePrinters: [
        {
          libraryPath: library.paths.root,
          labelTemplateId: "starter-4x6",
          printerId: "printer-zebra",
        },
      ],
    };
    render(
      <StatefulPrinterSettings initialSettings={settings}>
        <LabelPreviewDialog
          library={library}
          material={material}
          open
          onOpenChange={() => undefined}
          onEditTemplates={() => undefined}
        />
      </StatefulPrinterSettings>,
    );

    const printerSelect = screen.getByLabelText("Printer");
    await waitFor(() => expect(printerSelect.hasAttribute("disabled")).toBe(false));
    await chooseSelectOption(printerSelect, "No Printer");
    await waitFor(() => expect(getSelectValue(printerSelect)).toBe(""));
    await chooseSelectOption(printerSelect, "Rack labels");

    await waitFor(() => expect(getSelectValue(printerSelect)).toBe("printer-zebra"));
    expect(printLabelPdf).not.toHaveBeenCalled();
  });

  it("auto-prints after assigning a Printer on a different template than the one just cleared", async () => {
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [{ id: "printer-zebra", name: "Rack labels", queueName: "Zebra ZD421" }],
      labelTemplatePrinters: [
        {
          libraryPath: library.paths.root,
          labelTemplateId: "starter-4x6",
          printerId: "printer-zebra",
        },
      ],
    };
    render(
      <StatefulPrinterSettings initialSettings={settings}>
        <LabelPreviewDialog
          library={library}
          material={material}
          open
          onOpenChange={() => undefined}
          onEditTemplates={() => undefined}
        />
      </StatefulPrinterSettings>,
    );

    const printerSelect = screen.getByLabelText("Printer");
    await waitFor(() => expect(printerSelect.hasAttribute("disabled")).toBe(false));
    await chooseSelectOption(printerSelect, "No Printer");
    await waitFor(() => expect(getSelectValue(printerSelect)).toBe(""));

    await chooseSelectOption(screen.getByLabelText(/Label Template/i), "8.5×11 in");
    await waitFor(() => expect(printerSelect.hasAttribute("disabled")).toBe(false));
    await chooseSelectOption(printerSelect, "Rack labels");

    await waitFor(() => expect(printLabelPdf).toHaveBeenCalledTimes(1));
    expect(printLabelPdf).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      material.id,
      "Zebra ZD421",
      expect.objectContaining({ id: "starter-letter" }),
    );
  });

  it("assigns and prints once when a Printer is picked while Print is blocked", async () => {
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [{ id: "printer-zebra", name: "Rack labels", queueName: "Zebra ZD421" }],
    };
    render(
      <StatefulPrinterSettings initialSettings={settings}>
        <LabelPreviewDialog
          library={library}
          material={material}
          open
          onOpenChange={() => undefined}
          onEditTemplates={() => undefined}
        />
      </StatefulPrinterSettings>,
    );

    await screen.findByLabelText(/Label Template/i);
    expect(screen.getByRole("button", { name: /^Print$/i }).hasAttribute("disabled")).toBe(true);
    await chooseSelectOption(screen.getByLabelText("Printer"), "Rack labels");

    await waitFor(() => expect(printLabelPdf).toHaveBeenCalledTimes(1));
    expect(printLabelPdf).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      material.id,
      "Zebra ZD421",
      expect.objectContaining({ id: "starter-4x6" }),
    );
  });

  it("prints only the first assignment when a second Printer is chosen before assignment settles", async () => {
    let releaseAssignment: (() => void) | undefined;
    const assignmentGate = new Promise<void>((resolve) => {
      releaseAssignment = resolve;
    });
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [
        { id: "printer-zebra", name: "Rack labels", queueName: "Zebra ZD421" },
        { id: "printer-brother", name: "Shelf labels", queueName: "Brother QL" },
      ],
    };
    vi.mocked(listOsPrinterQueues).mockResolvedValue(["Zebra ZD421", "Brother QL"]);

    function GatedPrinterSettings({ children }: { children: ReactNode }) {
      const [nextSettings, setSettings] = useState(settings);
      return (
        <PrinterSettingsProvider
          settings={nextSettings}
          onSettingsChange={async (updated) => {
            await assignmentGate;
            setSettings(updated);
          }}
        >
          {children}
        </PrinterSettingsProvider>
      );
    }

    render(
      <GatedPrinterSettings>
        <LabelPreviewDialog
          library={library}
          material={material}
          open
          onOpenChange={() => undefined}
          onEditTemplates={() => undefined}
        />
      </GatedPrinterSettings>,
    );

    const printerSelect = screen.getByLabelText("Printer");
    await waitFor(() => expect(printerSelect.hasAttribute("disabled")).toBe(false));
    await chooseSelectOption(printerSelect, "Rack labels");
    await waitFor(() => expect(printerSelect.hasAttribute("disabled")).toBe(true));
    fireEvent.click(printerSelect);
    expect(screen.queryByRole("listbox")).toBeNull();
    releaseAssignment?.();

    await waitFor(() => expect(printLabelPdf).toHaveBeenCalledTimes(1));
    expect(printLabelPdf).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      material.id,
      "Zebra ZD421",
      expect.objectContaining({ id: "starter-4x6" }),
    );
  });

  it("closes and opens Global Printer settings from Add printer", async () => {
    const onOpenChange = vi.fn();
    const onManagePrinters = vi.fn();
    render(
      <LabelPreviewDialog
        library={library}
        material={material}
        open
        onOpenChange={onOpenChange}
        onEditTemplates={() => undefined}
        onManagePrinters={onManagePrinters}
      />,
    );

    const printerSelect = screen.getByLabelText("Printer");
    await waitFor(() => expect(printerSelect.hasAttribute("disabled")).toBe(false));
    await chooseSelectOption(printerSelect, "Add printer…");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onManagePrinters).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Save printer" })).toBeNull();
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
