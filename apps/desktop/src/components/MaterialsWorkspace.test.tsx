import type { OpenLibraryResult } from "@certtrace/library-engine";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import {
  chooseSelectOption,
  getSelectValue,
} from "../test/select-helpers";
import {
  addLibraryFieldOption,
  addMaterial,
} from "../lib/library-client";
import { MaterialsWorkspace } from "./MaterialsWorkspace";

vi.mock("../lib/library-client", () => ({
  addLibraryFieldOption: vi.fn(),
  addMaterial: vi.fn(),
  fetchMaterialAttachments: vi.fn(async () => []),
  updateMaterialMetadata: vi.fn(),
  updateLibraryFieldSchema: vi.fn(),
}));

const sampleLibrary = {
  paths: { root: "/tmp/shop", materials: "/tmp/shop/materials" },
  config: { name: "Main Shop", searchAllFields: true },
  fieldSchema: defaultFieldSchemaV1,
} as OpenLibraryResult;

const materials: IndexedMaterial[] = [
  {
    id: "AL-falcon-101",
    version: 1,
    fields: {
      family: "aluminum",
      alloy: "6061",
      temper: "t6",
      supplier: "mcmaster",
      storage_location: "Rack A",
    },
    identifiers: {
      heat_number: "H-22",
    },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
    libraryPath: "/tmp/shop",
    libraryName: "Main Shop",
  },
  {
    id: "AL-river-102",
    version: 1,
    fields: {
      family: "aluminum",
      alloy: "7075",
      supplier: "online_metals",
      storage_location: "Rack B",
    },
    identifiers: {
      heat_number: "H-44",
    },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
    libraryPath: "/tmp/shop",
    libraryName: "Main Shop",
  },
];

async function openFilters() {
  await userEvent.click(screen.getByRole("button", { name: /Open filters/i }));
}

async function applyFilters() {
  await userEvent.click(screen.getByRole("button", { name: /Apply filters/i }));
}

describe("MaterialsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters materials by search query", async () => {
    const filterMaterials = vi.fn((query: string) =>
      materials.filter((entry) =>
        `${entry.id} ${entry.identifiers.heat_number ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    );

    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={filterMaterials}
      />,
    );

    expect(within(screen.getByRole("table")).getByText("6061")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("7075")).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText(/Search Main Shop/i), "H-44");

    expect(filterMaterials).toHaveBeenCalled();
    expect(filterMaterials.mock.calls.at(-1)?.[0]).toBe("H-44");
  });

  it("shows filterable schema definitions in the flyout and narrows the current library", async () => {
    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    await openFilters();

    expect(screen.getByLabelText("Filter by Material")).toBeTruthy();
    expect(screen.getByLabelText("Filter by Supplier")).toBeTruthy();
    expect(screen.queryByLabelText("Filter by Notes")).toBeNull();
    expect(screen.queryByLabelText("Filter by Date Received")).toBeNull();
    expect(screen.queryByLabelText("Filter by Heat Number")).toBeNull();

    const storageFilter = screen.getByLabelText("Filter by Storage Location");
    await userEvent.click(storageFilter);
    expect(screen.getByRole("option", { name: "Rack A" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Rack B" })).toBeTruthy();
    await userEvent.click(storageFilter);

    await chooseSelectOption(screen.getByLabelText("Filter by Supplier"), "McMaster");
    await applyFilters();

    expect(within(screen.getByRole("table")).getByText("6061")).toBeTruthy();
    expect(within(screen.getByRole("table")).queryByText("7075")).toBeNull();
  });

  it("honors field dependencies in filter options", async () => {
    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    await openFilters();

    const familyFilter = screen.getByLabelText("Filter by Material");
    const alloyFilter = screen.getByLabelText("Filter by Alloy");
    await userEvent.click(alloyFilter);
    expect(screen.queryByRole("option", { name: "6061" })).toBeNull();
    await userEvent.click(alloyFilter);

    await chooseSelectOption(familyFilter, "Aluminum");

    await userEvent.click(alloyFilter);
    expect(screen.getByRole("option", { name: "6061" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "1018" })).toBeNull();
    await userEvent.click(alloyFilter);

    await chooseSelectOption(alloyFilter, "6061");
    await chooseSelectOption(familyFilter, "Steel");

    expect(getSelectValue(alloyFilter)).toBe("");
    await userEvent.click(alloyFilter);
    expect(screen.getByRole("option", { name: "1018" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "6061" })).toBeNull();
  });

  it("updates available filters when the reopened library schema changes", async () => {
    const commonProps = {
      activeLibraryPath: "/tmp/shop" as const,
      materials,
      onRefreshLibrary: async () => undefined,
      filterMaterials: () => materials,
    };
    const { rerender } = render(
      <MaterialsWorkspace
        {...commonProps}
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
      />,
    );

    await openFilters();
    expect(screen.getByLabelText("Filter by Material")).toBeTruthy();
    expect(screen.queryByLabelText("Filter by Notes")).toBeNull();

    const reopenedLibrary = {
      ...sampleLibrary,
      fieldSchema: {
        ...defaultFieldSchemaV1,
        fields: defaultFieldSchemaV1.fields.map((field) =>
          field.key === "family"
            ? { ...field, filterable: false }
            : field.key === "notes"
              ? { ...field, filterable: true }
              : field,
        ),
      },
    } as OpenLibraryResult;

    rerender(
      <MaterialsWorkspace
        {...commonProps}
        sessionLibraries={new Map([["/tmp/shop", reopenedLibrary]])}
      />,
    );

    await openFilters();
    expect(screen.queryByLabelText("Filter by Material")).toBeNull();
    expect(screen.getByLabelText("Filter by Notes")).toBeTruthy();
  });

  it("renders default list columns from the library field schema", () => {
    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    expect(screen.getByRole("button", { name: /^Material$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Alloy$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Temper$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Supplier$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Storage Location$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Identifiers$/i })).toBeTruthy();
    expect(screen.getAllByText("Aluminum").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("table")).getByText("McMaster")).toBeTruthy();
    expect(screen.getByText("H-22")).toBeTruthy();
  });

  it("renders the add form from the library field schema and saves keyed values", async () => {
    vi.mocked(addMaterial).mockResolvedValue({
      id: "AL-new-103",
      version: 1,
      fields: {},
      identifiers: {},
      createdAt: "2026-05-28T12:00:00.000Z",
      updatedAt: "2026-05-28T12:00:00.000Z",
    });
    const onRefreshLibrary = vi.fn(async () => undefined);

    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={onRefreshLibrary}
        filterMaterials={() => materials}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));

    expect(screen.getByLabelText("Material")).toBeTruthy();
    expect(screen.getByLabelText("Alloy")).toBeTruthy();
    expect(screen.getByLabelText("Temper")).toBeTruthy();
    expect(screen.getByLabelText("Shape")).toBeTruthy();
    expect(screen.getByLabelText("Traceability Type")).toBeTruthy();
    expect(screen.getByLabelText("Date Received")).toBeTruthy();
    expect(screen.getByLabelText("Heat Number")).toBeTruthy();
    expect(screen.getByLabelText("Lot Number")).toBeTruthy();
    expect(screen.getByLabelText("Purchase Order")).toBeTruthy();

    await chooseSelectOption(screen.getByLabelText("Material"), "Aluminum");
    await chooseSelectOption(screen.getByLabelText("Alloy"), "6061");
    await userEvent.type(screen.getByLabelText("Heat Number"), "H-100");

    await userEvent.click(screen.getAllByRole("button", { name: /^Add material$/i }).at(-1)!);

    expect(addMaterial).toHaveBeenCalledWith(
      sampleLibrary,
      expect.objectContaining({
        fields: expect.objectContaining({
          family: "aluminum",
          alloy: "6061",
        }),
        identifiers: expect.objectContaining({
          heat_number: "H-100",
        }),
      }),
    );
    expect(onRefreshLibrary).toHaveBeenCalledWith("/tmp/shop");
  });

  it("confirms and persists a new select option while receiving", async () => {
    const library = {
      ...sampleLibrary,
      fieldSchema: structuredClone(defaultFieldSchemaV1),
    } as OpenLibraryResult;
    vi.mocked(addLibraryFieldOption).mockImplementation(async () => {
      const option = { id: "5052_h32", label: "5052 H32" };
      const alloy = library.fieldSchema.fields.find((field) => field.key === "alloy");
      if (alloy) {
        alloy.options = [...(alloy.options ?? []), option];
        alloy.dependsOn = {
          ...alloy.dependsOn!,
          filterOptionsBy: {
            ...alloy.dependsOn?.filterOptionsBy,
            aluminum: [...(alloy.dependsOn?.filterOptionsBy?.aluminum ?? []), option.id],
          },
        };
      }
      return { option, fieldSchema: library.fieldSchema };
    });

    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", library]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));
    await chooseSelectOption(screen.getByLabelText("Material"), "Aluminum");
    await userEvent.click(screen.getByLabelText("Alloy"));
    await userEvent.click(screen.getByRole("button", { name: /Add Alloy/i }));
    await userEvent.type(screen.getByLabelText("New Alloy"), "5052 H32");

    expect(addLibraryFieldOption).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Confirm add/i }));

    expect(addLibraryFieldOption).toHaveBeenCalledWith(library, {
      fieldKey: "alloy",
      label: "5052 H32",
      currentValues: { family: "aluminum" },
    });
    expect(getSelectValue(screen.getByLabelText("Alloy"))).toBe("5052_h32");
  });

  it("blocks save when required schema fields are empty", async () => {
    const requiredSchema = {
      ...defaultFieldSchemaV1,
      fields: defaultFieldSchemaV1.fields.map((field) =>
        field.key === "family" ? { ...field, required: true } : field,
      ),
    };
    const library = { ...sampleLibrary, fieldSchema: requiredSchema } as OpenLibraryResult;

    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", library]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Add material/i }));
    await userEvent.click(screen.getAllByRole("button", { name: /^Add material$/i }).at(-1)!);

    expect(screen.getByText(/Material is required/i)).toBeTruthy();
    expect(addMaterial).not.toHaveBeenCalled();
  });
});
