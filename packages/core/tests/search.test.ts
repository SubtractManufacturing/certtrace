import { describe, expect, it } from "vitest";
import type { MaterialMetadataV1 } from "@certtrace/types";
import { buildSearchIndex, rankSearchResults, searchMaterials } from "../src/search/index.js";

function sampleMaterial(overrides: Partial<MaterialMetadataV1> = {}): MaterialMetadataV1 {
  return {
    version: 1,
    id: "AL-falcon-104",
    material: "6061-T6",
    supplier: "McMaster",
    heat: "A4921",
    location: "Rack B2",
    tags: ["aluminum"],
    notes: "QA signed off",
    barcode: "AL-falcon-104",
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
      material: "303 SS",
      supplier: "Online Metals",
      heat: "H9920",
      location: "Rack A1",
      tags: ["stainless"],
      notes: "",
      barcode: "SS-river-002",
    }),
  ];

  it("returns all materials for an empty query", () => {
    const index = buildSearchIndex(materials);
    expect(searchMaterials(index, "")).toHaveLength(2);
  });

  it("matches id, material, supplier, heat, tags, and notes", () => {
    const index = buildSearchIndex(materials);

    expect(searchMaterials(index, "falcon")).toHaveLength(1);
    expect(searchMaterials(index, "303")).toHaveLength(1);
    expect(searchMaterials(index, "mcmaster")).toHaveLength(1);
    expect(searchMaterials(index, "a4921")).toHaveLength(1);
    expect(searchMaterials(index, "stainless")).toHaveLength(1);
    expect(searchMaterials(index, "qa signed")).toHaveLength(1);
  });

  it("requires every query term to match", () => {
    const index = buildSearchIndex(materials);
    expect(searchMaterials(index, "6061 mcmaster")).toHaveLength(1);
    expect(searchMaterials(index, "6061 stainless")).toHaveLength(0);
  });

  it("can limit searchable fields", () => {
    const index = buildSearchIndex(materials, { searchAllFields: false });
    expect(searchMaterials(index, "mcmaster")).toHaveLength(0);
    expect(searchMaterials(index, "6061")).toHaveLength(1);
  });

  it("builds a 1k+ material index quickly", () => {
    const largeSet = Array.from({ length: 1200 }, (_, index) =>
      sampleMaterial({
        id: `AL-item-${index}`,
        material: `6061-${index}`,
        barcode: `AL-item-${index}`,
        heat: `H${index}`,
        location: `Rack ${index % 20}`,
        tags: [`tag-${index % 10}`],
        notes: `note ${index}`,
      }),
    );

    const started = performance.now();
    const index = buildSearchIndex(largeSet);
    const builtMs = performance.now() - started;

    const searchStarted = performance.now();
    const results = searchMaterials(index, "6061-999");
    const searchMs = performance.now() - searchStarted;

    expect(index.materials).toHaveLength(1200);
    expect(results).toHaveLength(1);
    expect(builtMs).toBeLessThan(500);
    expect(searchMs).toBeLessThan(50);
  });

  it("ranks exact id matches ahead of partial matches", () => {
    const index = buildSearchIndex([
      sampleMaterial({ id: "AL-falcon-104", barcode: "AL-falcon-104" }),
      sampleMaterial({
        id: "AL-falcon-104-backup",
        barcode: "AL-falcon-104-backup",
        material: "backup stock",
      }),
    ]);

    const ranked = rankSearchResults(index, "AL-falcon-104");
    expect(ranked[0]?.material.id).toBe("AL-falcon-104");
  });
});
