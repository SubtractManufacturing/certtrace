import type { OpenLibraryResult } from "@certtrace/library-engine";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import { addLibraryFieldOption, addMaterial } from "../lib/library-client";
import { MaterialsWorkspace } from "./MaterialsWorkspace";

vi.mock("../lib/library-client", () => ({
  addLibraryFieldOption: vi.fn(),
  addMaterial: vi.fn(),
  fetchMaterialAttachments: vi.fn(async () => []),
  updateMaterialMetadata: vi.fn(),
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

    expect(screen.getByText("6061")).toBeTruthy();
    expect(screen.getByText("7075")).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText(/Search Main Shop/i), "H-44");

    expect(filterMaterials).toHaveBeenCalled();
    expect(filterMaterials.mock.calls.at(-1)?.[0]).toBe("H-44");
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
    expect(screen.getByText("McMaster")).toBeTruthy();
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
      const option = { id: "titanium", label: "Titanium" };
      const family = library.fieldSchema.fields.find((field) => field.key === "family");
      if (family) {
        family.options = [...(family.options ?? []), option];
      }
      return option;
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
    await userEvent.click(screen.getByRole("button", { name: /Add Material option/i }));
    await userEvent.type(screen.getByLabelText("New Material option"), "Titanium");

    expect(addLibraryFieldOption).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Confirm add/i }));

    expect(addLibraryFieldOption).toHaveBeenCalledWith(library, "family", "Titanium", {});
    expect((screen.getByLabelText("Material") as HTMLSelectElement).value).toBe("titanium");
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
