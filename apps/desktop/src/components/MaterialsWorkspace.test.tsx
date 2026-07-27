import type { OpenLibraryResult } from "@certtrace/library-engine";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import {
  addLibraryFieldOption,
  addMaterial,
  updateLibraryFieldSchema,
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

  it("shows filterable schema definitions and narrows the current library", async () => {
    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    expect(screen.getByLabelText("Filter by Material")).toBeTruthy();
    expect(screen.getByLabelText("Filter by Supplier")).toBeTruthy();
    expect(screen.getByLabelText("Filter by Heat Number")).toBeTruthy();
    expect(screen.queryByLabelText("Filter by Notes")).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Filter by Supplier"), "mcmaster");

    expect(within(screen.getByRole("table")).getByText("6061")).toBeTruthy();
    expect(within(screen.getByRole("table")).queryByText("7075")).toBeNull();
  });

  it("filters by identifier values", async () => {
    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    await userEvent.type(screen.getByLabelText("Filter by Heat Number"), "h-44");

    expect(within(screen.getByRole("table")).getByText("7075")).toBeTruthy();
    expect(within(screen.getByRole("table")).queryByText("6061")).toBeNull();
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

    const familyFilter = screen.getByLabelText("Filter by Material");
    const alloyFilter = screen.getByLabelText("Filter by Alloy");
    expect(within(alloyFilter).queryByRole("option", { name: "6061" })).toBeNull();

    await userEvent.selectOptions(familyFilter, "aluminum");

    expect(within(alloyFilter).getByRole("option", { name: "6061" })).toBeTruthy();
    expect(within(alloyFilter).queryByRole("option", { name: "1018" })).toBeNull();

    await userEvent.selectOptions(alloyFilter, "6061");
    await userEvent.selectOptions(familyFilter, "steel");

    expect((alloyFilter as HTMLSelectElement).value).toBe("");
    expect(within(alloyFilter).getByRole("option", { name: "1018" })).toBeTruthy();
    expect(within(alloyFilter).queryByRole("option", { name: "6061" })).toBeNull();
  });

  it("updates available filters when the reopened library schema changes", () => {
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

  it("persists column picker changes and renders the selected columns", async () => {
    vi.mocked(updateLibraryFieldSchema).mockResolvedValue(sampleLibrary);

    render(
      <MaterialsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="/tmp/shop"
        materials={materials}
        onRefreshLibrary={async () => undefined}
        filterMaterials={() => materials}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Choose columns/i }));
    await userEvent.click(screen.getByLabelText("Alloy column"));
    await userEvent.click(screen.getByLabelText("Notes column"));
    await userEvent.click(screen.getByLabelText("Heat Number column"));
    await userEvent.click(screen.getByLabelText("Identifiers column"));
    await userEvent.click(screen.getByRole("button", { name: /Save columns/i }));

    expect(updateLibraryFieldSchema).toHaveBeenCalledWith(
      sampleLibrary,
      expect.objectContaining({
        tableColumns: expect.arrayContaining([
          { kind: "field", key: "notes" },
          { kind: "identifier", key: "heat_number" },
        ]),
      }),
    );
    expect(screen.queryByRole("button", { name: /^Alloy$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Notes$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Heat Number$/i })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("H-22")).toBeTruthy();
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

    await userEvent.selectOptions(screen.getByLabelText("Material"), "aluminum");
    await userEvent.selectOptions(screen.getByLabelText("Alloy"), "6061");
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
    await userEvent.selectOptions(screen.getByLabelText("Material"), "aluminum");
    await userEvent.click(screen.getByRole("button", { name: /Add Alloy option/i }));
    await userEvent.type(screen.getByLabelText("New Alloy option"), "5052 H32");

    expect(addLibraryFieldOption).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Confirm add/i }));

    expect(addLibraryFieldOption).toHaveBeenCalledWith(library, {
      fieldKey: "alloy",
      label: "5052 H32",
      currentValues: { family: "aluminum" },
    });
    expect((screen.getByLabelText("Alloy") as HTMLSelectElement).value).toBe("5052_h32");
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
