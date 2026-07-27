import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { MaterialMetadataV1 } from "@certtrace/types";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { fetchMaterialsMock } = vi.hoisted(() => ({
  fetchMaterialsMock: vi.fn(),
}));

vi.mock("../lib/library-client", () => ({
  fetchMaterials: fetchMaterialsMock,
  openLibraryAtPath: vi.fn(),
}));

import { useSearchIndex } from "./useSearchIndex";

function library(path: string, name: string): OpenLibraryResult {
  return {
    paths: { root: path },
    config: { name },
  } as OpenLibraryResult;
}

function material(id: string, identifier: string): MaterialMetadataV1 {
  return {
    version: 1,
    id,
    fields: { notes: `Notes for ${identifier}` },
    identifiers: { heat_number: identifier },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
  };
}

describe("useSearchIndex", () => {
  it("searches the current library by material ID and identifiers only", async () => {
    const north = library("/libraries/north", "North");
    const searchable = {
      ...material("AL-falcon-101", "HEAT-4921"),
      fields: {
        family: "aluminum",
        alloy: "6061",
        notes: "QA signed off",
      },
    };
    fetchMaterialsMock.mockResolvedValue([searchable]);
    const sessionLibraries = new Map([[north.paths.root, north]]);
    const recentLibraries: [] = [];

    const { result } = renderHook(() =>
      useSearchIndex({
        sessionLibraries,
        activeLibraryPath: north.paths.root,
        recentLibraries,
      }),
    );

    await waitFor(() => expect(result.current.indexedMaterials).toHaveLength(1));

    expect(result.current.filterMaterials("falcon")).toHaveLength(1);
    expect(result.current.filterMaterials("heat-4921")).toHaveLength(1);
    expect(result.current.filterMaterials("aluminum")).toHaveLength(0);
    expect(result.current.filterMaterials("6061")).toHaveLength(0);
    expect(result.current.filterMaterials("qa signed")).toHaveLength(0);
  });

  it("keeps All libraries search results scoped to the matching library", async () => {
    const north = library("/libraries/north", "North");
    const south = library("/libraries/south", "South");
    fetchMaterialsMock.mockImplementation(async (entry: OpenLibraryResult) =>
      entry.paths.root === north.paths.root
        ? [material("shared-001", "HEAT-NORTH")]
        : [material("shared-001", "HEAT-SOUTH")],
    );
    const sessionLibraries = new Map([
      [north.paths.root, north],
      [south.paths.root, south],
    ]);
    const recentLibraries: [] = [];

    const { result } = renderHook(() =>
      useSearchIndex({
        sessionLibraries,
        activeLibraryPath: "all",
        recentLibraries,
      }),
    );

    await waitFor(() => expect(result.current.indexedMaterials).toHaveLength(2));

    expect(result.current.filterMaterials("HEAT-NORTH")).toEqual([
      expect.objectContaining({
        id: "shared-001",
        libraryPath: north.paths.root,
      }),
    ]);
  });
});
