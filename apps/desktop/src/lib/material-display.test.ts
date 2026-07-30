import type { FieldSchemaV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { formatFieldValue, formatIdentifiersCue } from "./material-display";

const schema: FieldSchemaV1 = {
  version: 2,
  fields: [
    {
      key: "family",
      label: "Material",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "aluminum", label: "Aluminum" },
        { id: "steel", label: "Steel" },
      ],
    },
    {
      key: "tags",
      label: "Tags",
      type: "multi_select",
      required: false,
      filterable: true,
      options: [
        { id: "rush", label: "Rush" },
        { id: "remnant", label: "Remnant" },
      ],
    },
    {
      key: "storage_location",
      label: "Storage Location",
      type: "text",
      required: false,
      filterable: true,
    },
    {
      key: "qty",
      label: "Qty",
      type: "number",
      required: false,
      filterable: false,
    },
  ],
  identifierKinds: [
    { key: "heat_number", label: "Heat Number", required: false, filterable: true },
    { key: "lot_number", label: "Lot Number", required: false, filterable: true },
    { key: "purchase_order", label: "Purchase Order", required: false, filterable: true },
  ],
  attachmentKinds: [],
};

describe("formatFieldValue", () => {
  it("resolves single-select option ids to labels", () => {
    expect(formatFieldValue(schema, "family", "aluminum")).toBe("Aluminum");
  });

  it("resolves multi-select option ids to labels", () => {
    expect(formatFieldValue(schema, "tags", ["rush", "remnant"])).toBe("Rush, Remnant");
  });

  it("returns text and number values as-is", () => {
    expect(formatFieldValue(schema, "storage_location", "Rack B2")).toBe("Rack B2");
    expect(formatFieldValue(schema, "qty", 3)).toBe("3");
  });

  it("falls back to the raw id when the option is unknown", () => {
    expect(formatFieldValue(schema, "family", "titanium")).toBe("titanium");
  });
});

describe("formatIdentifiersCue", () => {
  it("joins present identifier values for a compact list cue", () => {
    expect(
      formatIdentifiersCue(schema, {
        heat_number: "H-22",
        purchase_order: "PO-9",
      }),
    ).toBe("H-22 · PO-9");
  });
});
