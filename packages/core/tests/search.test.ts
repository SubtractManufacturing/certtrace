import type { MaterialMetadataV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { buildSearchIndex, rankSearchResults, searchMaterials } from "../src/search/index.js";

function sampleMaterial(overrides: Partial<MaterialMetadataV1> = {}): MaterialMetadataV1 {
  return {
    version: 3,
    id: "AL-falcon-104",
    fields: {
      family: "aluminum",
      alloy: "6061",
      notes: "QA signed off",
    },
    identifiers: {
      heat_number: "A4921",
    },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
    ...overrides,
  };
}

describe("searchMaterials", () => {
  const materials = [
    sampleMaterial(),
    sampleMaterial({
      id: "SS-river-002",
      fields: {
        family: "stainless",
        alloy: "304",
      },
      identifiers: {
        heat_number: "H9920",
      },
    }),
  ];

  it("returns all materials for an empty query", () => {
    const index = buildSearchIndex(materials);
    expect(searchMaterials(index, "")).toHaveLength(2);
  });

  it("matches material id and identifier values only", () => {
    const index = buildSearchIndex(materials);

    expect(searchMaterials(index, "falcon")).toHaveLength(1);
    expect(searchMaterials(index, "a4921")).toHaveLength(1);
    expect(searchMaterials(index, "h9920")).toHaveLength(1);
    // Classification fields and notes are not searchable
    expect(searchMaterials(index, "aluminum")).toHaveLength(0);
    expect(searchMaterials(index, "6061")).toHaveLength(0);
    expect(searchMaterials(index, "qa signed")).toHaveLength(0);
  });

  it("requires every query term to match", () => {
    const index = buildSearchIndex(materials);
    expect(searchMaterials(index, "falcon a4921")).toHaveLength(1);
    expect(searchMaterials(index, "falcon h9920")).toHaveLength(0);
  });

  it("builds a 1k+ material index quickly", () => {
    const largeSet = Array.from({ length: 1200 }, (_, index) =>
      sampleMaterial({
        id: `AL-item-${index}`,
        identifiers: { heat_number: `H${index}` },
      }),
    );

    const started = performance.now();
    const index = buildSearchIndex(largeSet);
    const builtMs = performance.now() - started;

    const searchStarted = performance.now();
    const results = searchMaterials(index, "AL-item-999");
    const searchMs = performance.now() - searchStarted;

    expect(index.materials).toHaveLength(1200);
    expect(results).toHaveLength(1);
    expect(builtMs).toBeLessThan(500);
    expect(searchMs).toBeLessThan(50);
  });

  it("ranks exact id matches ahead of partial matches", () => {
    const index = buildSearchIndex([
      sampleMaterial({ id: "AL-falcon-104" }),
      sampleMaterial({
        id: "AL-falcon-104-backup",
        fields: { notes: "backup stock" },
      }),
    ]);

    const ranked = rankSearchResults(index, "AL-falcon-104");
    expect(ranked[0]?.material.id).toBe("AL-falcon-104");
  });
});
