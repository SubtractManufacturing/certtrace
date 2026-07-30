import {
  type FieldSchemaV1,
  LABEL_CONTENT_BARCODE,
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_QR,
  type LabelTemplate,
  labelTemplateSizePoints,
  type MaterialMetadataV1,
} from "@certtrace/types";
import bwipjs from "bwip-js";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

const EMPTY_PLACEHOLDER = "—";
const MARGIN = 18;
const MIN_FONT_SIZE = 7;
const DEFAULT_FONT_SIZE = 12;
const LABEL_FONT_SIZE = 9;

export interface LabelContentLine {
  key: string;
  label: string;
  value: string;
}

export interface LabelCodePayloads {
  qr?: string;
  barcode?: string;
}

export interface GenerateLabelPdfInput {
  template: LabelTemplate;
  materials: MaterialMetadataV1[];
  fieldSchema: FieldSchemaV1;
}

export type LabelLayoutSlot =
  | { kind: "text"; line: LabelContentLine }
  | { kind: "qr"; payload: string }
  | { kind: "barcode"; payload: string };

export interface GenerateLabelPdfResult {
  pdf: Uint8Array;
  /** Resolved text lines per Material (excludes qr/barcode slots). */
  lines: LabelContentLine[][];
  /** Ordered layout slots per Material (honors template contentKeys order). */
  slots: LabelLayoutSlot[][];
  /** Machine-readable payloads per Material when those slots are included. */
  codePayloads: LabelCodePayloads[];
  warnings: string[];
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

  for (const key of template.contentKeys) {
    if (key === LABEL_CONTENT_QR) {
      codes.qr = material.id;
      slots.push({ kind: "qr", payload: material.id });
      continue;
    }
    if (key === LABEL_CONTENT_BARCODE) {
      codes.barcode = material.id;
      slots.push({ kind: "barcode", payload: material.id });
      continue;
    }

    const value = resolveContentValue(material, fieldSchema, key);
    const line: LabelContentLine = {
      key,
      label: contentLabel(fieldSchema, key),
      value: value.length > 0 ? value : EMPTY_PLACEHOLDER,
    };
    lines.push(line);
    slots.push({ kind: "text", line });
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
  const dataUrl = await QRCode.toDataURL(payload, {
    margin: 0,
    width: sizePx,
    errorCorrectionLevel: "M",
  });
  return pdf.embedPng(dataUrl);
}

async function embedBarcode(pdf: PDFDocument, payload: string) {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: payload,
    scale: 2,
    height: 10,
    includetext: false,
  });
  return pdf.embedPng(png);
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  const lineHeight = size + 2;

  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line.length > 0) {
      page.drawText(line, { x, y: cursorY, size, font, color: rgb(0, 0, 0) });
      cursorY -= lineHeight;
    }
    line = word;
  }

  if (line.length > 0) {
    page.drawText(line, { x, y: cursorY, size, font, color: rgb(0, 0, 0) });
    cursorY -= lineHeight;
  }

  return cursorY;
}

async function drawMaterialPage(
  pdf: PDFDocument,
  template: LabelTemplate,
  slots: LabelLayoutSlot[],
  font: PDFFont,
  fontBold: PDFFont,
): Promise<{ warning?: string }> {
  const { widthPt, heightPt } = labelTemplateSizePoints(template.size);
  const page = pdf.addPage([widthPt, heightPt]);

  const contentWidth = widthPt - MARGIN * 2;
  let cursorY = heightPt - MARGIN;
  let fontSize = DEFAULT_FONT_SIZE;

  const textSlots = slots.filter((slot) => slot.kind === "text");
  const qrSize = Math.min(96, contentWidth * 0.35, heightPt * 0.35);
  const estimatedCodeHeight = slots.reduce((sum, slot) => {
    if (slot.kind === "qr") {
      return sum + qrSize + 12;
    }
    if (slot.kind === "barcode") {
      return sum + 40;
    }
    return sum;
  }, 0);
  const estimatedTextHeight = textSlots.length * (fontSize + LABEL_FONT_SIZE + 10);
  const available = heightPt - MARGIN * 2 - estimatedCodeHeight;

  if (estimatedTextHeight > available && textSlots.length > 0) {
    fontSize = Math.max(
      MIN_FONT_SIZE,
      Math.floor(available / textSlots.length - LABEL_FONT_SIZE - 4),
    );
  }

  for (const slot of slots) {
    if (slot.kind === "text") {
      const { line } = slot;
      page.drawText(line.label, {
        x: MARGIN,
        y: cursorY - LABEL_FONT_SIZE,
        size: LABEL_FONT_SIZE,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      cursorY -= LABEL_FONT_SIZE + 2;
      cursorY = drawWrappedText(
        page,
        line.value,
        MARGIN,
        cursorY - fontSize,
        contentWidth,
        fontSize,
        line.key === LABEL_CONTENT_MATERIAL_ID ? fontBold : font,
      );
      cursorY -= 6;
      continue;
    }

    if (slot.kind === "qr") {
      const qrImage = await embedQr(pdf, slot.payload, Math.round(qrSize * 4));
      cursorY -= qrSize;
      page.drawImage(qrImage, {
        x: MARGIN,
        y: Math.max(MARGIN, cursorY),
        width: qrSize,
        height: qrSize,
      });
      cursorY -= 8;
      continue;
    }

    const barcodeImage = await embedBarcode(pdf, slot.payload);
    const barcodeWidth = Math.min(contentWidth, barcodeImage.width);
    const barcodeHeight = Math.min(36, (barcodeImage.height / barcodeImage.width) * barcodeWidth);
    cursorY -= barcodeHeight;
    page.drawImage(barcodeImage, {
      x: MARGIN,
      y: Math.max(MARGIN, cursorY),
      width: barcodeWidth,
      height: barcodeHeight,
    });
    cursorY -= 8;
  }

  const overflowed = cursorY < MARGIN;
  return overflowed
    ? { warning: `Label content may not fit the ${template.name} paper size.` }
    : {};
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

    const { warning } = await drawMaterialPage(pdf, input.template, resolved.slots, font, fontBold);
    if (warning) {
      warnings.push(warning);
    }
  }

  return {
    pdf: await pdf.save(),
    lines,
    slots,
    codePayloads,
    warnings,
  };
}
