import {
  createLabelContentItem,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  type LabelTemplate,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import type { LabelLayoutSlot } from "../src/labels/layout.js";
import { alignedLeftPt, computeLabelPageLayout } from "../src/labels/layout.js";

const material: MaterialMetadataV1 = {
  version: SCHEMA_VERSION,
  id: "AL-falcon-104",
  fields: {
    family: "aluminum",
    alloy: "6061",
    temper: "t6511",
    storage_location: "Rack B2",
  },
  identifiers: {},
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

const template4x6: LabelTemplate = {
  id: "4x6",
  name: "4x6 in",
  size: { kind: "catalog", catalogId: "4x6" },
  displayUnit: "in",
  content: ["family", LABEL_CONTENT_MATERIAL_ID, LABEL_CONTENT_QR, LABEL_CONTENT_BARCODE].map(
    (key) => createLabelContentItem(key),
  ),
};

function slotsFromTemplate(template: LabelTemplate): LabelLayoutSlot[] {
  return template.content.map((item) => {
    if (item.key === LABEL_CONTENT_QR) {
      return { kind: "qr", payload: material.id, align: item.align, size: item.size };
    }
    if (item.key === LABEL_CONTENT_BARCODE) {
      return { kind: "barcode", payload: material.id, align: item.align, size: item.size };
    }
    return {
      kind: "text",
      line: {
        key: item.key,
        label: item.key,
        value: item.key === LABEL_CONTENT_MATERIAL_ID ? material.id : "Value",
      },
      align: item.align,
      size: item.size,
    };
  });
}

describe("computeLabelPageLayout", () => {
  it("uses 4x6 page dimensions in points", () => {
    const layout = computeLabelPageLayout(template4x6, slotsFromTemplate(template4x6));
    expect(layout.widthPt).toBeCloseTo(4 * 72, 1);
    expect(layout.heightPt).toBeCloseTo(6 * 72, 1);
  });

  it("sizes QR codes relative to the page width", () => {
    const layout = computeLabelPageLayout(template4x6, [
      { kind: "qr", payload: material.id, align: "left", size: "medium" },
    ]);
    const qr = layout.elements.find((element) => element.kind === "qr");
    expect(qr?.kind).toBe("qr");
    if (qr?.kind === "qr") {
      expect(qr.sizePt).toBeCloseTo((layout.widthPt - layout.marginPt * 2) * 0.35, 1);
    }
  });

  it("scales QR size by content size weight", () => {
    const medium = computeLabelPageLayout(template4x6, [
      { kind: "qr", payload: material.id, align: "left", size: "medium" },
    ]);
    const large = computeLabelPageLayout(template4x6, [
      { kind: "qr", payload: material.id, align: "left", size: "large" },
    ]);
    const mediumQr = medium.elements.find((element) => element.kind === "qr");
    const largeQr = large.elements.find((element) => element.kind === "qr");
    expect(mediumQr?.kind).toBe("qr");
    expect(largeQr?.kind).toBe("qr");
    if (mediumQr?.kind === "qr" && largeQr?.kind === "qr") {
      expect(largeQr.sizePt).toBeCloseTo(mediumQr.sizePt * 1.25, 1);
    }
  });

  it("centers QR when align is center", () => {
    const layout = computeLabelPageLayout(template4x6, [
      { kind: "qr", payload: material.id, align: "center", size: "medium" },
    ]);
    const qr = layout.elements.find((element) => element.kind === "qr");
    expect(qr?.kind).toBe("qr");
    if (qr?.kind === "qr") {
      const contentWidth = layout.widthPt - layout.marginPt * 2;
      expect(qr.leftPt).toBeCloseTo(
        alignedLeftPt(layout.marginPt, contentWidth, qr.sizePt, "center"),
        1,
      );
    }
  });

  it("centers barcode when align is center", () => {
    const layout = computeLabelPageLayout(template4x6, [
      { kind: "barcode", payload: material.id, align: "center", size: "medium" },
    ]);
    const barcode = layout.elements.find((element) => element.kind === "barcode");
    expect(barcode?.kind).toBe("barcode");
    if (barcode?.kind === "barcode") {
      const contentWidth = layout.widthPt - layout.marginPt * 2;
      expect(barcode.widthPt).toBeLessThan(contentWidth);
      expect(barcode.leftPt).toBeCloseTo(
        alignedLeftPt(layout.marginPt, contentWidth, barcode.widthPt, "center"),
        1,
      );
      expect(barcode.leftPt).toBeGreaterThan(layout.marginPt);
    }
  });

  it("right-aligns barcode when align is right", () => {
    const layout = computeLabelPageLayout(template4x6, [
      { kind: "barcode", payload: material.id, align: "right", size: "medium" },
    ]);
    const barcode = layout.elements.find((element) => element.kind === "barcode");
    expect(barcode?.kind).toBe("barcode");
    if (barcode?.kind === "barcode") {
      const contentWidth = layout.widthPt - layout.marginPt * 2;
      expect(barcode.widthPt).toBeLessThan(contentWidth);
      expect(barcode.leftPt).toBeCloseTo(
        alignedLeftPt(layout.marginPt, contentWidth, barcode.widthPt, "right"),
        1,
      );
      expect(barcode.leftPt).toBeGreaterThan(layout.marginPt);
    }
  });

  it("wraps long values onto multiple lines", () => {
    const slots: LabelLayoutSlot[] = [
      {
        kind: "text",
        line: {
          key: "notes",
          label: "Notes",
          value: "This is a very long note that should wrap across multiple lines on a label.",
        },
        align: "left",
        size: "medium",
      },
    ];
    const layout = computeLabelPageLayout(template4x6, slots);
    const field = layout.elements.find((element) => element.kind === "field");
    expect(field?.kind).toBe("field");
    if (field?.kind === "field") {
      expect(field.valueLines.length).toBeGreaterThan(1);
    }
  });

  it("flags overflow on very small labels with lots of content", () => {
    const tinyTemplate: LabelTemplate = {
      id: "tiny",
      name: "Tiny",
      size: { kind: "custom", widthIn: 1, heightIn: 0.5 },
      displayUnit: "in",
      content: [
        "family",
        "alloy",
        "temper",
        "shape",
        "storage_location",
        LABEL_CONTENT_MATERIAL_ID,
        LABEL_CONTENT_QR,
        LABEL_CONTENT_BARCODE,
      ].map((key) => createLabelContentItem(key)),
    };
    const layout = computeLabelPageLayout(tinyTemplate, slotsFromTemplate(tinyTemplate));
    expect(layout.overflow).toBe(true);
  });
});
