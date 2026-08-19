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
import { render, screen, waitFor, within } from "@testing-library/react";
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
  archived: false,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

function sampleLibrary(overrides: Partial<OpenLibraryResult["config"]> = {}): OpenLibraryResult {
  const config = { ...createDefaultLibraryConfigV1("Main Shop"), ...overrides };
  return {
    paths: { root: "/tmp/shop", materials: "/tmp/shop/materials" },
    config,
    fieldSchema: defaultFieldSchemaV1,
  } as OpenLibraryResult;
}

function mockPersist(library: OpenLibraryResult) {
  vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => ({
    ...library,
    config: { ...library.config, ...partial },
  }));
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

    expect(screen.getByRole("table", { name: /Label Templates/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit 4×6 in/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit 8\.5×11 in/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Set 4×6 in as default/i }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /Set 8\.5×11 in as default/i }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("creates a Label Template from the modal and can set it as default in the list", async () => {
    let library = sampleLibrary();
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });
    vi.mocked(updateLibraryConfigPartial).mockImplementation(async (_lib, partial) => {
      library = {
        ...library,
        config: { ...library.config, ...partial },
      };
      return library;
    });

    const view = render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Add template/i }));
    expect(screen.getByRole("heading", { name: /Create Label Template/i })).toBeTruthy();

    const nameInput = screen.getByLabelText(/Template name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Rack tag");
    await userEvent.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => expect(updateLibraryConfigPartial).toHaveBeenCalled());
    const createdId = library.config.labelTemplates.find((t) => t.name === "Rack tag")?.id;
    expect(createdId).toBeTruthy();

    view.rerender(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Set Rack tag as default/i }));
    await waitFor(() => expect(library.config.defaultLabelTemplateId).toBe(createdId));
  });

  it("cancels create without persisting", async () => {
    const library = sampleLibrary();
    mockPersist(library);

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Add template/i }));
    await userEvent.clear(screen.getByLabelText(/Template name/i));
    await userEvent.type(screen.getByLabelText(/Template name/i), "Discard me");
    await userEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(screen.queryByRole("heading", { name: /Create Label Template/i })).toBeNull();
    expect(updateLibraryConfigPartial).not.toHaveBeenCalled();
  });

  it("blocks deleting the last Label Template", async () => {
    let library = sampleLibrary();
    mockPersist(library);

    const view = render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    for (const name of [/Delete 8\.5×11 in/i, /Delete 3×1 in/i]) {
      await userEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(updateLibraryConfigPartial).toHaveBeenCalled());
      library = {
        ...library,
        config: {
          ...library.config,
          ...vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1],
        },
      };
      mockPersist(library);
      view.rerender(
        <LabelTemplatesEditor
          library={library}
          onLibraryUpdated={() => undefined}
          onRefreshLibrary={async () => undefined}
        />,
      );
      vi.mocked(updateLibraryConfigPartial).mockClear();
    }

    expect(screen.queryByRole("button", { name: /Delete 8\.5×11 in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete 3×1 in/i })).toBeNull();
    expect(
      (screen.getByRole("button", { name: /Delete 4×6 in/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(library.config.defaultLabelTemplateId).toBe(STARTER_LABEL_TEMPLATE_4X6_ID);
  });

  it("reassigns default when the default Label Template is deleted", async () => {
    const templates = createStarterLabelTemplates();
    const library = sampleLibrary({
      labelTemplates: templates,
      defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_4X6_ID,
    });
    mockPersist(library);

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Delete 4×6 in/i }));
    await waitFor(() =>
      expect(vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1]).toMatchObject({
        defaultLabelTemplateId: STARTER_LABEL_TEMPLATE_LETTER_ID,
        labelTemplates: expect.not.arrayContaining([
          expect.objectContaining({ id: STARTER_LABEL_TEMPLATE_4X6_ID }),
        ]),
      }),
    );
  });

  it("edits label size via catalog or custom dimensions with unit suffix switching", async () => {
    const library = sampleLibrary();
    mockPersist(library);

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Edit 4×6 in/i }));
    expect(screen.getByRole("heading", { name: /Edit Label Template/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeTruthy();

    await chooseSelectOption(screen.getByLabelText(/Label size/i), "Custom");
    const width = document.getElementById("label-template-width");
    const height = document.getElementById("label-template-height");
    expect(width).toBeTruthy();
    expect(height).toBeTruthy();
    await userEvent.clear(width!);
    await userEvent.type(width!, "100mm");
    await userEvent.clear(height!);
    await userEvent.type(height!, "150");

    expect(getSelectValue(screen.getByLabelText(/Display unit/i))).toBe("mm");

    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(updateLibraryConfigPartial).toHaveBeenCalled());
    const saved = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1]?.labelTemplates?.[0];
    expect(saved?.displayUnit).toBe("mm");
    expect(saved?.size.kind).toBe("custom");
    if (saved?.size.kind === "custom") {
      expect(saved.size.widthIn).toBeCloseTo(100 / 25.4, 5);
      expect(saved.size.heightIn).toBeCloseTo(150 / 25.4, 5);
    }
  });

  it("offers Dimensions instead of individual dimension field slots", async () => {
    render(
      <LabelTemplatesEditor
        library={sampleLibrary()}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Edit 4×6 in/i }));

    expect(screen.getByLabelText(/Include Dimensions/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Include Width/i)).toBeNull();
    expect(screen.queryByLabelText(/Include Height/i)).toBeNull();
    expect(screen.queryByLabelText(/Include Thickness/i)).toBeNull();
  });

  it("toggles content slots and edits align/size on enabled rows", async () => {
    const library = sampleLibrary();
    mockPersist(library);

    render(
      <LabelTemplatesEditor
        library={library}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Edit 4×6 in/i }));
    await userEvent.click(screen.getByLabelText(/Include Barcode/i));
    await userEvent.click(screen.getByLabelText(/Include Temper/i));
    await userEvent.click(screen.getAllByRole("radio", { name: /^Center$/i })[0]!);
    await userEvent.click(screen.getAllByRole("radio", { name: /^Large$/i })[0]!);

    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(updateLibraryConfigPartial).toHaveBeenCalled());
    const saved = vi.mocked(updateLibraryConfigPartial).mock.calls.at(-1)?.[1]?.labelTemplates?.[0];
    expect(saved?.content.map((item) => item.key)).toEqual([
      "family",
      "alloy",
      "size",
      "material_id",
      "qr",
      "barcode",
    ]);
    expect(saved?.content[0]).toMatchObject({
      key: "family",
      align: "center",
      size: "large",
    });
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

    await userEvent.click(screen.getByRole("button", { name: /Edit 4×6 in/i }));

    const preview = await screen.findByRole("region", { name: /Label preview/i });
    expect(preview.textContent).toContain("AL-falcon-104");
    expect(preview.textContent).toContain("Aluminum");
    expect(preview.textContent).toContain("1.25 in");

    await userEvent.click(screen.getByLabelText(/Include Temper/i));
    expect(preview.textContent).not.toContain("T6511");

    await chooseSelectOption(screen.getByLabelText(/Preview with/i), "ST-oak-220");
    await waitFor(() => {
      expect(preview.textContent).toContain("ST-oak-220");
      expect(preview.textContent).toContain("Steel");
    });

    // Preview pane stays mounted while settings content is present
    expect(within(preview).getByTestId("label-live-preview")).toBeTruthy();
  });
});
