import {
  createLabelContentItem,
  createStarterLabelTemplates,
  defaultFieldSchemaV1,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  type LabelTemplate,
  type MaterialMetadataV1,
  SCHEMA_VERSION,
  STARTER_LABEL_TEMPLATE_4X6_ID,
} from "@certtrace/types";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateLabelPdf } from "../src/labels/generate.js";

const material: MaterialMetadataV1 = {
  version: SCHEMA_VERSION,
  id: "AL-falcon-104",
  fields: {
    family: "aluminum",
    alloy: "6061",
    temper: "t6511",
    storage_location: "Rack B2",
  },
  identifiers: {
    heat_number: "A4921",
  },
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

const emptyMaterial: MaterialMetadataV1 = {
  version: SCHEMA_VERSION,
  id: "EMPTY-1",
  fields: {},
  identifiers: {},
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

function starter4x6(): LabelTemplate {
  return createStarterLabelTemplates().find((t) => t.id === STARTER_LABEL_TEMPLATE_4X6_ID)!;
}

describe("generateLabelPdf", () => {
  it("generates a non-empty PDF with page size matching the template", async () => {
    const { pdf } = await generateLabelPdf({
      template: starter4x6(),
      materials: [material],
      fieldSchema: defaultFieldSchemaV1,
    });

    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(500);

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(4 * 72, 1);
    expect(height).toBeCloseTo(6 * 72, 1);
  });

  it("produces one page per Material", async () => {
    const second: MaterialMetadataV1 = { ...material, id: "AL-river-105" };
    const { pdf } = await generateLabelPdf({
      template: starter4x6(),
      materials: [material, second],
      fieldSchema: defaultFieldSchemaV1,
    });

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);
  });

  it("includes placeholders for empty included field values", async () => {
    const template: LabelTemplate = {
      id: "placeholders",
      name: "Placeholders",
      size: { kind: "catalog", catalogId: "4x6" },
      displayUnit: "in",
      content: ["family", "alloy", LABEL_CONTENT_MATERIAL_ID].map((key) => createLabelContentItem(key)),
    };

    const { lines } = await generateLabelPdf({
      template,
      materials: [emptyMaterial],
      fieldSchema: defaultFieldSchemaV1,
    });

    expect(lines[0]).toEqual([
      { key: "family", label: "Material", value: "—" },
      { key: "alloy", label: "Alloy", value: "—" },
      { key: LABEL_CONTENT_MATERIAL_ID, label: "Material id", value: "EMPTY-1" },
    ]);
  });

  it("resolves select option labels and includes QR/barcode payloads as Material id", async () => {
    const template: LabelTemplate = {
      id: "codes",
      name: "Codes",
      size: { kind: "catalog", catalogId: "letter" },
      displayUnit: "in",
      content: ["family", LABEL_CONTENT_MATERIAL_ID, LABEL_CONTENT_QR, LABEL_CONTENT_BARCODE].map((key) => createLabelContentItem(key)),
    };

    const result = await generateLabelPdf({
      template,
      materials: [material],
      fieldSchema: defaultFieldSchemaV1,
    });

    expect(result.lines[0]?.[0]).toEqual({
      key: "family",
      label: "Material",
      value: "Aluminum",
    });
    expect(result.codePayloads[0]).toEqual({
      qr: "AL-falcon-104",
      barcode: "AL-falcon-104",
    });
    expect(result.pdf.byteLength).toBeGreaterThan(500);
  });

  it("honors content order including QR before text", async () => {
    const template: LabelTemplate = {
      id: "qr-first",
      name: "QR first",
      size: { kind: "catalog", catalogId: "4x6" },
      displayUnit: "in",
      content: [LABEL_CONTENT_QR, "family", LABEL_CONTENT_MATERIAL_ID].map((key) => createLabelContentItem(key)),
    };

    const { slots } = await generateLabelPdf({
      template,
      materials: [material],
      fieldSchema: defaultFieldSchemaV1,
    });

    expect(slots[0]?.map((slot) => slot.kind)).toEqual(["qr", "text", "text"]);
    expect(slots[0]?.[1]).toMatchObject({
      kind: "text",
      line: { key: "family", value: "Aluminum" },
    });
  });

  it("still returns a PDF when content may overflow the page", async () => {
    const template: LabelTemplate = {
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

    const { pdf, warnings } = await generateLabelPdf({
      template,
      materials: [material],
      fieldSchema: defaultFieldSchemaV1,
    });

    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(warnings.length).toBeGreaterThan(0);
  });
});
