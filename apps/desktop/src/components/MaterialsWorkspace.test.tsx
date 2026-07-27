import type { OpenLibraryResult } from "@certtrace/library-engine";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    fields: {
      alloy: "6061",
      supplier: "MetalCo",
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
      alloy: "7075",
      supplier: "AeroSupply",
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
  it("filters materials by search query", async () => {
    const filterMaterials = vi.fn((query: string) =>
      materials.filter((entry) =>
        `${entry.id} ${entry.identifiers.heat_number ?? ""}`.toLowerCase().includes(query.toLowerCase()),
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
});
