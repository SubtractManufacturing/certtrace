import {
  createLabelContentItem,
  createStarterLabelTemplates,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  type LabelTemplate,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
  STARTER_LABEL_TEMPLATE_3X1_ID,
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

  it("overflows a large 3x1 barcode into a second column after text", () => {
    const template3x1: LabelTemplate = {
      id: "3x1",
      name: "3x1 in",
      size: { kind: "catalog", catalogId: "3x1" },
      displayUnit: "in",
      content: [
        createLabelContentItem(LABEL_CONTENT_MATERIAL_ID),
        createLabelContentItem(LABEL_CONTENT_BARCODE, { size: "large" }),
      ],
    };
    const layout = computeLabelPageLayout(template3x1, [
      {
        kind: "text",
        line: {
          key: LABEL_CONTENT_MATERIAL_ID,
          label: "Material id",
          value: material.id,
        },
        align: "left",
        size: "medium",
      },
      { kind: "barcode", payload: material.id, align: "left", size: "large" },
    ]);
    expect(layout.widthPt).toBeCloseTo(3 * 72, 1);
    expect(layout.heightPt).toBeCloseTo(1 * 72, 1);
    expect(layout.marginPt).toBeLessThan(18);
    expect(layout.overflow).toBe(false);

    const field = layout.elements.find((element) => element.kind === "field");
    const barcode = layout.elements.find((element) => element.kind === "barcode");
    expect(field?.kind).toBe("field");
    expect(barcode?.kind).toBe("barcode");
    if (field?.kind === "field" && barcode?.kind === "barcode") {
      // First column filled, large barcode overflows into column 2.
      expect(barcode.leftPt).toBeGreaterThan(field.leftPt + field.widthPt / 2);
      expect(Math.abs(field.topPt - barcode.topPt)).toBeLessThan(1);
    }
  });

  it("stacks material id under a small 3x1 barcode in one column", () => {
    const template3x1: LabelTemplate = {
      id: "3x1-stack",
      name: "3x1 stack",
      size: { kind: "catalog", catalogId: "3x1" },
      displayUnit: "in",
      content: [
        createLabelContentItem(LABEL_CONTENT_BARCODE, { size: "small", align: "center" }),
        createLabelContentItem(LABEL_CONTENT_MATERIAL_ID),
      ],
    };
    const layout = computeLabelPageLayout(template3x1, [
      { kind: "barcode", payload: material.id, align: "center", size: "small" },
      {
        kind: "text",
        line: {
          key: LABEL_CONTENT_MATERIAL_ID,
          label: "Material id",
          value: material.id,
        },
        align: "left",
        size: "medium",
      },
    ]);
    expect(layout.overflow).toBe(false);
    const barcode = layout.elements.find((element) => element.kind === "barcode");
    const field = layout.elements.find((element) => element.kind === "field");
    expect(barcode?.kind).toBe("barcode");
    expect(field?.kind).toBe("field");
    if (barcode?.kind === "barcode" && field?.kind === "field") {
      expect(field.topPt).toBeGreaterThan(barcode.topPt + barcode.heightPt - 1);
      expect(Math.abs(field.leftPt - layout.marginPt)).toBeLessThan(0.1);
      expect(field.widthPt).toBeCloseTo(layout.widthPt - layout.marginPt * 2, 0);
    }
  });

  it("uses the full 3x1 width when a lone barcode fits in one column", () => {
    const template3x1: LabelTemplate = {
      id: "3x1-barcode",
      name: "3x1 barcode",
      size: { kind: "catalog", catalogId: "3x1" },
      displayUnit: "in",
      content: [createLabelContentItem(LABEL_CONTENT_BARCODE, { align: "center" })],
    };
    const layout = computeLabelPageLayout(template3x1, [
      { kind: "barcode", payload: material.id, align: "center", size: "medium" },
    ]);
    const barcode = layout.elements.find((element) => element.kind === "barcode");
    expect(barcode?.kind).toBe("barcode");
    if (barcode?.kind === "barcode") {
      const contentWidth = layout.widthPt - layout.marginPt * 2;
      expect(barcode.widthPt).toBeGreaterThan(contentWidth * 0.5);
      expect(barcode.leftPt).toBeCloseTo(
        alignedLeftPt(layout.marginPt, contentWidth, barcode.widthPt, "center"),
        1,
      );
    }
  });

  it("lays out the starter 3x1 content without overflow", () => {
    const starter3x1 = createStarterLabelTemplates().find(
      (template) => template.id === STARTER_LABEL_TEMPLATE_3X1_ID,
    );
    expect(starter3x1).toBeDefined();
    if (!starter3x1) {
      return;
    }
    const layout = computeLabelPageLayout(starter3x1, slotsFromTemplate(starter3x1));
    expect(layout.overflow).toBe(false);
    expect(layout.elements).toHaveLength(starter3x1.content.length);
  });

  it("keeps portrait 4x6 as a single vertical stack", () => {
    const layout = computeLabelPageLayout(template4x6, slotsFromTemplate(template4x6));
    const field = layout.elements.find((element) => element.kind === "field");
    const qr = layout.elements.find((element) => element.kind === "qr");
    expect(field?.kind).toBe("field");
    expect(qr?.kind).toBe("qr");
    if (field?.kind === "field" && qr?.kind === "qr") {
      expect(qr.topPt).toBeGreaterThan(field.topPt);
      expect(Math.abs(field.leftPt - layout.marginPt)).toBeLessThan(0.1);
    }
  });
});
