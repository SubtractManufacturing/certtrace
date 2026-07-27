import type { MaterialMetadataV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  defaultFieldSchemaV1,
  filterableFields,
  filterableIdentifierKinds,
  filterMaterialsBySchema,
  sanitizeMaterialFilterFields,
} from "../src/index.js";

const materials: MaterialMetadataV1[] = [
  {
    version: 1,
    id: "AL-falcon-101",
    fields: {
      family: "aluminum",
      alloy: "6061",
      supplier: "mcmaster",
      notes: "Priority aerospace order",
    },
    identifiers: { heat_number: "H-22" },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
  },
  {
    version: 1,
    id: "AL-river-102",
    fields: {
      family: "aluminum",
      alloy: "7075",
      supplier: "online_metals",
    },
    identifiers: { heat_number: "H-44" },
    createdAt: "2026-05-28T12:00:00.000Z",
    updatedAt: "2026-05-28T12:00:00.000Z",
  },
];

describe("material filters", () => {
  it("narrows materials by filterable fields and identifier kinds", () => {
    expect(
      filterMaterialsBySchema(materials, defaultFieldSchemaV1, {
        fields: { supplier: "mcmaster" },
        identifiers: { heat_number: "h-22" },
      }).map((material) => material.id),
    ).toEqual(["AL-falcon-101"]);
  });

  it("ignores filters for definitions that are not available", () => {
    expect(
      filterMaterialsBySchema(materials, defaultFieldSchemaV1, {
        fields: { notes: "aerospace", missing: "value" },
        identifiers: { missing: "value" },
      }),
    ).toEqual(materials);
  });

  it("exposes only enabled filterable schema definitions", () => {
    const schema = {
      ...defaultFieldSchemaV1,
      fields: defaultFieldSchemaV1.fields.map((field) =>
        field.key === "family" ? { ...field, disabled: true } : field,
      ),
    };

    expect(filterableFields(schema).map((field) => field.key)).not.toContain("family");
    expect(filterableFields(schema).map((field) => field.key)).not.toContain("notes");
    expect(filterableIdentifierKinds(schema).map((kind) => kind.key)).toEqual([
      "heat_number",
      "lot_number",
      "purchase_order",
    ]);
  });

  it("removes filter values invalidated by field dependencies", () => {
    expect(
      sanitizeMaterialFilterFields(defaultFieldSchemaV1, {
        family: "steel",
        alloy: "6061",
        temper: "t6",
      }),
    ).toEqual({ family: "steel" });
  });
});
