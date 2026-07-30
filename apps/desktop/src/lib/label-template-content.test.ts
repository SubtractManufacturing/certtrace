import {
  defaultFieldSchemaV1,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  createSampleLabelMaterial,
  labelContentOptions,
  moveContentKey,
} from "./label-template-content";

describe("labelContentOptions", () => {
  it("offers core slots plus every Field and Identifier kind", () => {
    const options = labelContentOptions(defaultFieldSchemaV1);
    const keys = options.map((option) => option.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        LABEL_CONTENT_MATERIAL_ID,
        LABEL_CONTENT_QR,
        LABEL_CONTENT_BARCODE,
        "family",
        "alloy",
        "temper",
        "heat_number",
        "lot_number",
        "purchase_order",
      ]),
    );
    expect(options.find((option) => option.key === "family")?.label).toBe("Material");
    expect(options.find((option) => option.key === LABEL_CONTENT_MATERIAL_ID)?.label).toBe(
      "Material id",
    );
  });
});

describe("moveContentKey", () => {
  it("reorders an included content key within the stack", () => {
    expect(moveContentKey(["family", "alloy", "temper"], "alloy", -1)).toEqual([
      "alloy",
      "family",
      "temper",
    ]);
    expect(moveContentKey(["family", "alloy", "temper"], "family", -1)).toBeNull();
    expect(moveContentKey(["family", "alloy", "temper"], "temper", 1)).toBeNull();
  });
});

describe("createSampleLabelMaterial", () => {
  it("returns a sample Material with typical field and identifier values", () => {
    const sample = createSampleLabelMaterial();
    expect(sample.id).toBe("AL-falcon-104");
    expect(sample.fields.family).toBe("aluminum");
    expect(sample.identifiers.heat_number).toBe("A4921");
  });
});
