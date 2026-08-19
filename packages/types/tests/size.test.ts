import { describe, expect, it } from "vitest";
import { defaultFieldSchemaV1 } from "../src/seeds/v1.js";
import { formatMaterialSize, renderSizePattern } from "../src/size.js";

describe("renderSizePattern", () => {
  it("drops an empty trailing dimension before the unit suffix", () => {
    expect(renderSizePattern("{width} x {height} {unit}", { width: 2 }, "in")).toBe("2 in");
  });
});

describe("formatMaterialSize", () => {
  it("renders a partial rect_bar Size without a leftover x before the unit", () => {
    expect(
      formatMaterialSize(defaultFieldSchemaV1, {
        fields: { shape: "rect_bar", width: 2 },
        sizeUnit: "in",
      }),
    ).toBe("2 in");
  });
});
