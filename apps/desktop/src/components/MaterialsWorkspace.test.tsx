import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import { MaterialsWorkspace } from "./MaterialsWorkspace";

vi.mock("../lib/library-client", () => ({
  addMaterial: vi.fn(),
  fetchMaterialAttachments: vi.fn(async () => []),
}));

const sampleLibrary = {
  paths: { root: "/tmp/shop", materials: "/tmp/shop/materials" },
  config: { name: "Main Shop", searchAllFields: true },
} as OpenLibraryResult;

const materials: IndexedMaterial[] = [
  {
    id: "AL-falcon-101",
    version: 1,
    material: "6061-T6",
    supplier: "MetalCo",
    heat: "H-22",
    location: "Rack A",
    tags: [],
    notes: "",
    barcode: "",
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
    libraryPath: "/tmp/shop",
    libraryName: "Main Shop",
  },
  {
    id: "AL-river-102",
    version: 1,
    material: "7075-T651",
    supplier: "AeroSupply",
    heat: "H-44",
    location: "Rack B",
    tags: [],
    notes: "",
    barcode: "",
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
    libraryPath: "/tmp/shop",
    libraryName: "Main Shop",
  },
];

describe("MaterialsWorkspace", () => {
  it("filters materials by search query", async () => {
    const filterMaterials = vi.fn((query: string) =>
      materials.filter((entry) =>
        `${entry.id} ${entry.material} ${entry.supplier}`.toLowerCase().includes(query.toLowerCase()),
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

    expect(screen.getByText("6061-T6")).toBeTruthy();
    expect(screen.getByText("7075-T651")).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText(/Search Main Shop/i), "7075");

    expect(filterMaterials).toHaveBeenCalled();
    expect(filterMaterials.mock.calls.at(-1)?.[0]).toBe("7075");
  });
});
