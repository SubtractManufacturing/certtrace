import {
  createLabelContentItem,
  defaultFieldSchemaV1,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  LABEL_CONTENT_SIZE,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  createSampleLabelMaterial,
  disableContentItem,
  enableContentItem,
  labelContentListRows,
  labelContentOptions,
  patchContentItem,
  reorderContentItems,
} from "./label-template-content";

describe("labelContentOptions", () => {
  it("offers core slots plus Fields and Identifier kinds", () => {
    const options = labelContentOptions(defaultFieldSchemaV1);
    const keys = options.map((option) => option.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        LABEL_CONTENT_SIZE,
        LABEL_CONTENT_MATERIAL_ID,
        LABEL_CONTENT_QR,
        LABEL_CONTENT_BARCODE,
        "family",
        "alloy",
        "temper",
        "width",
        "height",
        "thickness",
        "heat_number",
        "lot_number",
        "purchase_order",
      ]),
    );
    expect(options.find((option) => option.key === "family")?.label).toBe("Material");
    expect(options.find((option) => option.key === LABEL_CONTENT_SIZE)?.label).toBe("Size");
    expect(options.find((option) => option.key === LABEL_CONTENT_MATERIAL_ID)?.label).toBe(
      "Material id",
    );
  });

  it("skips schema fields and identifiers that collide with core Label keys", () => {
    const options = labelContentOptions({
      ...defaultFieldSchemaV1,
      fields: [
        ...defaultFieldSchemaV1.fields,
        {
          key: LABEL_CONTENT_QR,
          label: "QR Field",
          type: "text",
          required: false,
          filterable: false,
        },
      ],
      identifierKinds: [
        ...defaultFieldSchemaV1.identifierKinds,
        {
          key: LABEL_CONTENT_BARCODE,
          label: "Barcode Id",
          required: false,
          filterable: false,
        },
      ],
    });
    const keys = options.map((option) => option.key);
    expect(keys.filter((key) => key === LABEL_CONTENT_QR)).toHaveLength(1);
    expect(keys.filter((key) => key === LABEL_CONTENT_BARCODE)).toHaveLength(1);
    expect(options.find((option) => option.key === LABEL_CONTENT_QR)?.label).toBe("QR");
  });
});

describe("labelContentListRows", () => {
  it("lists enabled content first in template order, then disabled catalog options", () => {
    const options = labelContentOptions(defaultFieldSchemaV1);
    const content = [createLabelContentItem("alloy"), createLabelContentItem(LABEL_CONTENT_QR)];
    const rows = labelContentListRows(options, content);

    expect(rows.filter((row) => row.kind === "enabled").map((row) => row.option.key)).toEqual([
      "alloy",
      LABEL_CONTENT_QR,
    ]);
    expect(rows.findIndex((row) => row.kind === "enabled")).toBe(0);
    expect(
      rows.findIndex((row) => row.kind === "disabled" && row.option.key === "family"),
    ).toBeGreaterThan(1);
    expect(
      rows.every((row, index, list) => {
        if (row.kind === "enabled") {
          return list.slice(0, index).every((prior) => prior.kind === "enabled");
        }
        return list.slice(index).every((later) => later.kind === "disabled");
      }),
    ).toBe(true);
  });
});

describe("reorderContentItems", () => {
  it("moves an enabled item to another enabled item's position", () => {
    const content = ["family", "alloy", "temper"].map((key) => createLabelContentItem(key));
    expect(reorderContentItems(content, "alloy", "family").map((item) => item.key)).toEqual([
      "alloy",
      "family",
      "temper",
    ]);
    expect(reorderContentItems(content, "family", "family")).toEqual(content);
  });
});

describe("enableContentItem / disableContentItem / patchContentItem", () => {
  it("appends defaults when enabling and drops prefs when disabling", () => {
    const content = [createLabelContentItem("family", { align: "center", size: "large" })];
    const withAlloy = enableContentItem(content, "alloy");
    expect(withAlloy).toEqual([
      createLabelContentItem("family", { align: "center", size: "large" }),
      createLabelContentItem("alloy"),
    ]);
    expect(disableContentItem(withAlloy, "family")).toEqual([createLabelContentItem("alloy")]);
    expect(disableContentItem(content, "family")).toBeNull();
  });

  it("patches align and size on an enabled item", () => {
    const content = [createLabelContentItem("family")];
    expect(patchContentItem(content, "family", { align: "right", size: "small" })).toEqual([
      createLabelContentItem("family", { align: "right", size: "small" }),
    ]);
  });
});

describe("createSampleLabelMaterial", () => {
  it("returns a sample Material with typical field and identifier values", () => {
    const sample = createSampleLabelMaterial();
    expect(sample.id).toBe("AL-falcon-104");
    expect(sample.fields.family).toBe("aluminum");
    expect(sample.fields.diameter).toBe(1.25);
    expect(sample.sizeUnit).toBe("in");
    expect(sample.identifiers.heat_number).toBe("A4921");
  });
});
