import {
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  type LabelTemplate,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
} from "@certtrace/types";
import { describe, expect, it } from "vitest";
import type { LabelLayoutSlot } from "../src/labels/layout.js";
import { computeLabelPageLayout } from "../src/labels/layout.js";

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
  contentKeys: ["family", LABEL_CONTENT_MATERIAL_ID, LABEL_CONTENT_QR, LABEL_CONTENT_BARCODE],
};

function slotsFromKeys(keys: string[]): LabelLayoutSlot[] {
  return keys.map((key) => {
    if (key === LABEL_CONTENT_QR) {
      return { kind: "qr", payload: material.id };
    }
    if (key === LABEL_CONTENT_BARCODE) {
      return { kind: "barcode", payload: material.id };
    }
    return {
      kind: "text",
      line: { key, label: key, value: key === LABEL_CONTENT_MATERIAL_ID ? material.id : "Value" },
    };
  });
}

describe("computeLabelPageLayout", () => {
  it("uses 4x6 page dimensions in points", () => {
    const layout = computeLabelPageLayout(template4x6, slotsFromKeys(template4x6.contentKeys));
    expect(layout.widthPt).toBeCloseTo(4 * 72, 1);
    expect(layout.heightPt).toBeCloseTo(6 * 72, 1);
  });

  it("sizes QR codes relative to the page width", () => {
    const layout = computeLabelPageLayout(template4x6, [{ kind: "qr", payload: material.id }]);
    const qr = layout.elements.find((element) => element.kind === "qr");
    expect(qr?.kind).toBe("qr");
    if (qr?.kind === "qr") {
      expect(qr.sizePt).toBeCloseTo((layout.widthPt - layout.marginPt * 2) * 0.35, 1);
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
      contentKeys: [
        "family",
        "alloy",
        "temper",
        "shape",
        "storage_location",
        LABEL_CONTENT_MATERIAL_ID,
        LABEL_CONTENT_QR,
        LABEL_CONTENT_BARCODE,
      ],
    };
    const layout = computeLabelPageLayout(tinyTemplate, slotsFromKeys(tinyTemplate.contentKeys));
    expect(layout.overflow).toBe(true);
  });
});
