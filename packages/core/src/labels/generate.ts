import {
  type FieldSchemaV1,
  formatMaterialSize,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  LABEL_CONTENT_SIZE,
  type LabelTemplate,
  labelTemplateSizePoints,
  type MaterialMetadataV1,
} from "@certtrace/types";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import { renderBarcodePngBytes, renderQrDataUrl } from "./code-images.js";
import {
  alignedLeftPt,
  computeLabelPageLayout,
  LABEL_VALUE_LINE_GAP_PT,
  type LabelContentLine,
  type LabelLayoutSlot,
  type LabelTextMeasurer,
} from "./layout.js";

export type { LabelContentLine, LabelLayoutSlot } from "./layout.js";

const EMPTY_PLACEHOLDER = "—";

export interface LabelCodePayloads {
  qr?: string;
  barcode?: string;
}

export interface GenerateLabelPdfInput {
  template: LabelTemplate;
  materials: MaterialMetadataV1[];
  fieldSchema: FieldSchemaV1;
}

export interface GenerateLabelPdfResult {
  pdf: Uint8Array;
  /** Resolved text lines per Material (excludes qr/barcode slots). */
  lines: LabelContentLine[][];
  /** Ordered layout slots per Material (honors template content order). */
  slots: LabelLayoutSlot[][];
  /** Machine-readable payloads per Material when those slots are included. */
  codePayloads: LabelCodePayloads[];
  warnings: string[];
}

function createPdfTextMeasurer(font: PDFFont, fontBold: PDFFont): LabelTextMeasurer {
  return {
    widthOfText(text, fontSizePt, bold) {
      return (bold ? fontBold : font).widthOfTextAtSize(text, fontSizePt);
    },
  };
}

function rawFieldValue(material: MaterialMetadataV1, key: string): string {
  const value = material.fields[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "";
}

function displayFieldValue(
  material: MaterialMetadataV1,
  fieldSchema: FieldSchemaV1,
  key: string,
): string {
  const field = fieldSchema.fields.find((entry) => entry.key === key);
  const raw = rawFieldValue(material, key);
  if (!raw) {
    return "";
  }
  if (!field || (field.type !== "single_select" && field.type !== "multi_select")) {
    return raw;
  }

  if (field.type === "multi_select") {
    const ids = Array.isArray(material.fields[key])
      ? (material.fields[key] as string[])
      : raw.split(", ").filter(Boolean);
    return ids
      .map((id) => field.options?.find((option) => option.id === id)?.label ?? id)
      .join(", ");
  }

  return field.options?.find((option) => option.id === raw)?.label ?? raw;
}

function contentLabel(fieldSchema: FieldSchemaV1, key: string): string {
  if (key === LABEL_CONTENT_MATERIAL_ID) {
    return "Material id";
  }
  if (key === LABEL_CONTENT_SIZE) {
    return "Size";
  }
  if (key === LABEL_CONTENT_QR) {
    return "QR";
  }
  if (key === LABEL_CONTENT_BARCODE) {
    return "Barcode";
  }
  const field = fieldSchema.fields.find((entry) => entry.key === key);
  if (field) {
    return field.label;
  }
  const identifier = fieldSchema.identifierKinds.find((entry) => entry.key === key);
  if (identifier) {
    return identifier.label;
  }
  return key;
}

function resolveContentValue(
  material: MaterialMetadataV1,
  fieldSchema: FieldSchemaV1,
  key: string,
): string {
  if (key === LABEL_CONTENT_MATERIAL_ID) {
    return material.id;
  }
  if (key === LABEL_CONTENT_QR || key === LABEL_CONTENT_BARCODE) {
    return material.id;
  }
  if (key === LABEL_CONTENT_SIZE) {
    return formatMaterialSize(fieldSchema, material);
  }
  if (fieldSchema.fields.some((entry) => entry.key === key)) {
    return displayFieldValue(material, fieldSchema, key);
  }
  return material.identifiers[key] ?? "";
}

export function resolveLabelLayout(
  template: LabelTemplate,
  material: MaterialMetadataV1,
  fieldSchema: FieldSchemaV1,
): { slots: LabelLayoutSlot[]; lines: LabelContentLine[]; codes: LabelCodePayloads } {
  const slots: LabelLayoutSlot[] = [];
  const lines: LabelContentLine[] = [];
  const codes: LabelCodePayloads = {};

  for (const item of template.content) {
    const { key, align, size } = item;
    if (key === LABEL_CONTENT_QR) {
      codes.qr = material.id;
      slots.push({ kind: "qr", payload: material.id, align, size });
      continue;
    }
    if (key === LABEL_CONTENT_BARCODE) {
      codes.barcode = material.id;
      slots.push({ kind: "barcode", payload: material.id, align, size });
      continue;
    }
    if (key === LABEL_CONTENT_SIZE) {
      const sizeValue = resolveContentValue(material, fieldSchema, key);
      if (sizeValue.length === 0) {
        continue;
      }
      const line: LabelContentLine = {
        key,
        label: contentLabel(fieldSchema, key),
        value: sizeValue,
      };
      lines.push(line);
      slots.push({ kind: "text", line, align, size });
      continue;
    }

    const value = resolveContentValue(material, fieldSchema, key);
    const line: LabelContentLine = {
      key,
      label: contentLabel(fieldSchema, key),
      value: value.length > 0 ? value : EMPTY_PLACEHOLDER,
    };
    lines.push(line);
    slots.push({ kind: "text", line, align, size });
  }

  return { slots, lines, codes };
}

export function resolveLabelLines(
  template: LabelTemplate,
  material: MaterialMetadataV1,
  fieldSchema: FieldSchemaV1,
): { lines: LabelContentLine[]; codes: LabelCodePayloads } {
  const { lines, codes } = resolveLabelLayout(template, material, fieldSchema);
  return { lines, codes };
}

async function embedQr(pdf: PDFDocument, payload: string, sizePx: number) {
  return pdf.embedPng(await renderQrDataUrl(payload, sizePx));
}

async function embedBarcode(pdf: PDFDocument, payload: string) {
  return pdf.embedPng(await renderBarcodePngBytes(payload));
}

async function drawMaterialPage(
  pdf: PDFDocument,
  template: LabelTemplate,
  slots: LabelLayoutSlot[],
  font: PDFFont,
  fontBold: PDFFont,
): Promise<{ warnings: string[] }> {
  const layout = computeLabelPageLayout(template, slots, createPdfTextMeasurer(font, fontBold));
  const { widthPt, heightPt } = labelTemplateSizePoints(template.size);
  const page = pdf.addPage([widthPt, heightPt]);
  const warnings: string[] = [];

  for (const element of layout.elements) {
    if (element.kind === "field") {
      const labelBaselineY = heightPt - element.topPt - element.labelFontSizePt;
      const labelWidth = font.widthOfTextAtSize(element.line.label, element.labelFontSizePt);
      page.drawText(element.line.label, {
        x: alignedLeftPt(element.leftPt, element.widthPt, labelWidth, element.align),
        y: labelBaselineY,
        size: element.labelFontSizePt,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });

      let valueTopPt =
        element.topPt + element.labelFontSizePt + LABEL_VALUE_LINE_GAP_PT + element.valueFontSizePt;
      const valueFont = element.valueBold ? fontBold : font;
      for (const line of element.valueLines) {
        const lineWidth = valueFont.widthOfTextAtSize(line, element.valueFontSizePt);
        page.drawText(line, {
          x: alignedLeftPt(element.leftPt, element.widthPt, lineWidth, element.align),
          y: heightPt - valueTopPt,
          size: element.valueFontSizePt,
          font: valueFont,
          color: rgb(0, 0, 0),
        });
        valueTopPt += element.valueFontSizePt + LABEL_VALUE_LINE_GAP_PT;
      }
      continue;
    }

    if (element.kind === "qr") {
      try {
        const qrImage = await embedQr(pdf, element.payload, Math.round(element.sizePt * 4));
        page.drawImage(qrImage, {
          x: element.leftPt,
          y: heightPt - element.topPt - element.sizePt,
          width: element.sizePt,
          height: element.sizePt,
        });
      } catch {
        warnings.push("Could not render the QR code for this Label.");
      }
      continue;
    }

    try {
      const barcodeImage = await embedBarcode(pdf, element.payload);
      const imageAspect = barcodeImage.width / Math.max(barcodeImage.height, 1);
      let barcodeWidth = element.widthPt;
      let barcodeHeight = barcodeWidth / imageAspect;
      if (barcodeHeight > element.heightPt) {
        barcodeHeight = element.heightPt;
        barcodeWidth = barcodeHeight * imageAspect;
      }
      page.drawImage(barcodeImage, {
        x: alignedLeftPt(element.leftPt, element.widthPt, barcodeWidth, element.align),
        y: heightPt - element.topPt - barcodeHeight,
        width: barcodeWidth,
        height: barcodeHeight,
      });
    } catch {
      warnings.push("Could not render the barcode for this Label.");
    }
  }

  if (layout.overflow) {
    warnings.push(`Label content may not fit the ${template.name} label size.`);
  }
  return { warnings };
}

export async function generateLabelPdf(
  input: GenerateLabelPdfInput,
): Promise<GenerateLabelPdfResult> {
  if (input.materials.length === 0) {
    throw new Error("generateLabelPdf requires at least one Material");
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const lines: LabelContentLine[][] = [];
  const slots: LabelLayoutSlot[][] = [];
  const codePayloads: LabelCodePayloads[] = [];
  const warnings: string[] = [];

  for (const material of input.materials) {
    const resolved = resolveLabelLayout(input.template, material, input.fieldSchema);
    lines.push(resolved.lines);
    slots.push(resolved.slots);
    codePayloads.push(resolved.codes);

    const pageResult = await drawMaterialPage(pdf, input.template, resolved.slots, font, fontBold);
    warnings.push(...pageResult.warnings);
  }

  return {
    pdf: await pdf.save(),
    lines,
    slots,
    codePayloads,
    warnings,
  };
}
