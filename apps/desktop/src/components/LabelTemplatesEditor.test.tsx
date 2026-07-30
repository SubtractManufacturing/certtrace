import type { OpenLibraryResult } from "@certtrace/library-engine";
import {
  createDefaultLibraryConfigV1,
  createStarterLabelTemplates,
  defaultFieldSchemaV1,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
  STARTER_LABEL_TEMPLATE_4X6_ID,
  STARTER_LABEL_TEMPLATE_LETTER_ID,
} from "@certtrace/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMaterials, updateLibraryConfigPartial } from "../lib/library-client";
import { chooseSelectOption, getSelectValue } from "../test/select-helpers";
import { LabelTemplatesEditor } from "./LabelTemplatesEditor";

vi.mock("../lib/library-client", () => ({
  updateLibraryConfigPartial: vi.fn(),
  fetchMaterials: vi.fn().mockResolvedValue([]),
}));

const realMaterial: MaterialMetadataV1 = {
  version: SCHEMA_VERSION,
  id: "ST-oak-220",
  fields: {
    family: "steel",
    alloy: "4140",
    temper: "annealed",
  },
  identifiers: {},
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

function sampleLibrary(
  overrides: Partial<OpenLibraryResult["config"]> = {},
): OpenLibraryResult {
  const config = { ...createDefaultLibraryConfigV1("Main Shop"), ...overrides };
  return {
    paths: { root: "/tmp/shop", materials: "/tmp/shop/materials" },
    config,
    fieldSchema: defaultFieldSchemaV1,
  } as OpenLibraryResult;
}

describe("LabelTemplatesEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists Label Templates and marks the library default", () => {
    render(
      <LabelTemplatesEditor
        library={sampleLibrary()}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    expect(screen.getByRole("list", { name: /Label Templates/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit 4×6 in/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit 8\.5×11 in/i })).toBeTruthy();
    expect(
      (screen.getByLabelText(/Default template: 4×6 in/i) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("creates, renames, and sets a new default Label Template", async () => {
    const library = sampleLibrary();
    const onLibraryUpdated = vi.fn();
    vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => ({
      ...library,
      config: { ...library.config, ...partial },
    }));

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /New template/i }));
    const nameInput = screen.getByLabelText(/Template name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Rack tag");
    await userEvent.click(screen.getByRole("button", { name: /Set as default/i }));
    await userEvent.click(screen.getByRole("button", { name: /Save templates/i }));

    expect(updateLibraryConfigPartial).toHaveBeenCalled();
    const partial = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1];
    expect(partial?.labelTemplates?.some((t) => t.name === "Rack tag")).toBe(true);
    expect(
      partial?.labelTemplates?.find((t) => t.id === partial.defaultLabelTemplateId)?.name,
    ).toBe("Rack tag");
    expect(onLibraryUpdated).toHaveBeenCalled();
  });

  it("blocks deleting the last Label Template and reassigns default when deleting it", async () => {
    const library = sampleLibrary();
    vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => ({
      ...library,
      config: { ...library.config, ...partial },
    }));

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    // Select the letter template and delete it first
    await userEvent.click(screen.getByRole("button", { name: /Edit 8\.5×11 in/i }));
    await userEvent.click(screen.getByRole("button", { name: /Delete template/i }));
    expect(screen.queryByRole("button", { name: /Edit 8\.5×11 in/i })).toBeNull();
    expect(
      (screen.getByLabelText(/Default template: 4×6 in/i) as HTMLInputElement).checked,
    ).toBe(true);

    // Last remaining template cannot be deleted
    expect(
      (screen.getByRole("button", { name: /Delete template/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Save templates/i }));
    const partial = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1];
    expect(partial?.labelTemplates).toHaveLength(1);
    expect(partial?.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_4X6_ID);
  });

  it("reassigns default when the default Label Template is deleted", async () => {
    const templates = createStarterLabelTemplates();
    const library = sampleLibrary({
      labelTemplates: templates,
      defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
    });
    vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => ({
      ...library,
      config: { ...library.config, ...partial },
    }));

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Edit 4×6 in/i }));
    await userEvent.click(screen.getByRole("button", { name: /Delete template/i }));

    expect(screen.queryByRole("button", { name: /Edit 4×6 in/i })).toBeNull();
    expect(
      (screen.getByLabelText(/Default template: 8\.5×11 in/i) as HTMLInputElement).checked,
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Save templates/i }));
    const partial = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1];
    expect(partial?.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_LETTER_ID);
  });

  it("edits paper size via catalog or custom dimensions with unit suffix switching", async () => {
    const library = sampleLibrary();
    vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => ({
      ...library,
      config: { ...library.config, ...partial },
    }));

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await chooseSelectOption(screen.getByLabelText(/Paper size/i), "Custom");
    const width = screen.getByLabelText(/Width/i);
    const height = screen.getByLabelText(/Height/i);
    await userEvent.clear(width);
    await userEvent.type(width, "100mm");
    await userEvent.clear(height);
    await userEvent.type(height, "150");

    expect(getSelectValue(screen.getByLabelText(/Display unit/i))).toBe("mm");

    await userEvent.click(screen.getByRole("button", { name: /Save templates/i }));
    const saved = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1]
      ?.labelTemplates?.[0];
    expect(saved?.displayUnit).toBe("mm");
    expect(saved?.size.kind).toBe("custom");
    if (saved?.size.kind === "custom") {
      expect(saved.size.widthIn).toBeCloseTo(100 / 25.4, 5);
      expect(saved.size.heightIn).toBeCloseTo(150 / 25.4, 5);
    }
  });

  it("toggles content slots and reorders the included stack", async () => {
    const library = sampleLibrary();
    vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => ({
      ...library,
      config: { ...library.config, ...partial },
    }));

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    // Starter includes family/alloy/temper/material_id/qr — add barcode, remove temper, move Material id up
    await userEvent.click(screen.getByLabelText(/Include Barcode/i));
    await userEvent.click(screen.getByLabelText(/Include Temper/i));
    await userEvent.click(screen.getByRole("button", { name: /Move Material id up/i }));

    await userEvent.click(screen.getByRole("button", { name: /Save templates/i }));
    const saved = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1]
      ?.labelTemplates?.[0];
    expect(saved?.contentKeys).toEqual([
      "family",
      "material_id",
      "alloy",
      "qr",
      "barcode",
    ]);
  });

  it("shows a live preview with the sample Material and can preview with a real Material", async () => {
    vi.mocked(fetchMaterials).mockResolvedValue([realMaterial]);
    const library = sampleLibrary();

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    const preview = await screen.findByRole("region", { name: /Label preview/i });
    expect(preview.textContent).toContain("AL-falcon-104");
    expect(preview.textContent).toContain("Aluminum");

    await userEvent.click(screen.getByLabelText(/Include Temper/i));
    expect(preview.textContent).not.toContain("T6511");

    await chooseSelectOption(screen.getByLabelText(/Preview with/i), "ST-oak-220");
    await waitFor(() => {
      expect(preview.textContent).toContain("ST-oak-220");
      expect(preview.textContent).toContain("Steel");
    });
  });
});
