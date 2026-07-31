import {
  LABEL_CONTENT_MATERIAL_ID,
  LABEL_CONTENT_SIZE_WEIGHT,
  type LabelContentAlign,
  type LabelContentSize,
  type LabelTemplate,
  labelTemplateSizePoints,
} from "@certtrace/types";

export interface LabelContentLine {
  key: string;
  label: string;
  value: string;
}

export type LabelLayoutSlot =
  | {
      kind: "text";
      line: LabelContentLine;
      align: LabelContentAlign;
      size: LabelContentSize;
    }
  | {
      kind: "qr";
      payload: string;
      align: LabelContentAlign;
      size: LabelContentSize;
    }
  | {
      kind: "barcode";
      payload: string;
      align: LabelContentAlign;
      size: LabelContentSize;
    };

export const LABEL_MARGIN_PT = 18;
/** Wide labels at/above this W:H ratio pack into columns. */
export const LABEL_WIDE_ASPECT_RATIO = 1.5;
export const LABEL_COLUMN_GAP_PT = 8;
export const LABEL_MIN_FONT_SIZE_PT = 7;
export const LABEL_DEFAULT_VALUE_FONT_SIZE_PT = 12;
export const LABEL_LABEL_FONT_SIZE_PT = 9;
export const LABEL_QR_MAX_SIZE_PT = 96;
export const LABEL_BARCODE_MAX_HEIGHT_PT = 36;
/** Typical Code128 width/height ratio for short Material ids (layout estimate). */
export const LABEL_BARCODE_ASPECT = 6;
const LABEL_FIELD_GAP_PT = 6;
const LABEL_CODE_GAP_PT = 8;
const LABEL_SHORT_FIELD_GAP_PT = 3;
const LABEL_SHORT_CODE_GAP_PT = 4;
/** S/M/L barcode height as a fraction of content height (short labels especially). */
const LABEL_BARCODE_HEIGHT_FRACTION: Record<LabelContentSize, number> = {
  small: 0.32,
  medium: 0.5,
  large: 0.72,
};
export const LABEL_VALUE_LINE_GAP_PT = 2;

function isShortLabel(heightPt: number): boolean {
  return heightPt <= 96;
}

function fieldGapPt(heightPt: number): number {
  return isShortLabel(heightPt) ? LABEL_SHORT_FIELD_GAP_PT : LABEL_FIELD_GAP_PT;
}

function codeGapPt(heightPt: number): number {
  return isShortLabel(heightPt) ? LABEL_SHORT_CODE_GAP_PT : LABEL_CODE_GAP_PT;
}

export interface LabelTextMeasurer {
  widthOfText(text: string, fontSizePt: number, bold: boolean): number;
}

export function createApproxTextMeasurer(): LabelTextMeasurer {
  return {
    widthOfText(text, fontSizePt, bold) {
      return text.length * fontSizePt * (bold ? 0.52 : 0.48);
    },
  };
}

export type LabelLayoutElement =
  | {
      kind: "qr";
      payload: string;
      leftPt: number;
      topPt: number;
      sizePt: number;
      align: LabelContentAlign;
    }
  | {
      kind: "barcode";
      payload: string;
      leftPt: number;
      topPt: number;
      widthPt: number;
      heightPt: number;
      align: LabelContentAlign;
    }
  | {
      kind: "field";
      line: LabelContentLine;
      leftPt: number;
      topPt: number;
      widthPt: number;
      labelFontSizePt: number;
      valueFontSizePt: number;
      valueLines: string[];
      valueBold: boolean;
      align: LabelContentAlign;
    };

export interface LabelPageLayout {
  widthPt: number;
  heightPt: number;
  marginPt: number;
  valueFontSizePt: number;
  overflow: boolean;
  elements: LabelLayoutElement[];
}

export function alignedLeftPt(
  contentLeftPt: number,
  contentWidthPt: number,
  elementWidthPt: number,
  align: LabelContentAlign,
): number {
  if (align === "center") {
    return contentLeftPt + (contentWidthPt - elementWidthPt) / 2;
  }
  if (align === "right") {
    return contentLeftPt + contentWidthPt - elementWidthPt;
  }
  return contentLeftPt;
}

function sizeWeight(size: LabelContentSize): number {
  return LABEL_CONTENT_SIZE_WEIGHT[size];
}

function breakLongToken(
  token: string,
  maxWidthPt: number,
  fontSizePt: number,
  bold: boolean,
  measurer: LabelTextMeasurer,
): string[] {
  if (measurer.widthOfText(token, fontSizePt, bold) <= maxWidthPt) {
    return [token];
  }

  const parts: string[] = [];
  let chunk = "";
  for (const char of token) {
    const candidate = `${chunk}${char}`;
    if (chunk.length > 0 && measurer.widthOfText(candidate, fontSizePt, bold) > maxWidthPt) {
      parts.push(chunk);
      chunk = char;
      continue;
    }
    chunk = candidate;
  }
  if (chunk.length > 0) {
    parts.push(chunk);
  }
  return parts.length > 0 ? parts : [token];
}

function wrapText(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  bold: boolean,
  measurer: LabelTextMeasurer,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const pieces = breakLongToken(word, maxWidthPt, fontSizePt, bold, measurer);
    for (const piece of pieces) {
      const candidate = line.length === 0 ? piece : `${line} ${piece}`;
      if (measurer.widthOfText(candidate, fontSizePt, bold) <= maxWidthPt) {
        line = candidate;
        continue;
      }
      if (line.length > 0) {
        lines.push(line);
      }
      line = piece;
    }
  }

  if (line.length > 0) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

/** Portrait labels keep 18pt; short/wide labels get tighter chrome. */
export function resolveLabelMarginPt(widthPt: number, heightPt: number): number {
  if (isShortLabel(heightPt)) {
    return 4;
  }
  if (heightPt <= 144 || widthPt / heightPt >= LABEL_WIDE_ASPECT_RATIO) {
    return 10;
  }
  return LABEL_MARGIN_PT;
}

export function resolveColumnCount(widthPt: number, heightPt: number): number {
  return widthPt / Math.max(heightPt, 1) >= LABEL_WIDE_ASPECT_RATIO ? 2 : 1;
}

function columnWidthPt(contentWidthPt: number, columns: number): number {
  if (columns <= 1) {
    return contentWidthPt;
  }
  return (contentWidthPt - LABEL_COLUMN_GAP_PT * (columns - 1)) / columns;
}

function qrSizePt(
  columnWidth: number,
  contentHeightPt: number,
  pageContentWidthPt: number,
  columns: number,
  size: LabelContentSize,
): number {
  // Portrait: modest QR relative to the page. Wide multi-column: fill most of the code column.
  // Weight scales the preferred size, then geometry/max caps prevent column overflow.
  const geometryBudget =
    columns === 1
      ? Math.min(pageContentWidthPt * 0.35, contentHeightPt * 0.35)
      : Math.min(columnWidth * 0.9, contentHeightPt * 0.9);
  return Math.min(LABEL_QR_MAX_SIZE_PT, geometryBudget, geometryBudget * sizeWeight(size));
}

function barcodeHeightPt(size: LabelContentSize, contentHeightPt: number): number {
  const fromFraction = contentHeightPt * LABEL_BARCODE_HEIGHT_FRACTION[size];
  const fromAbsolute = LABEL_BARCODE_MAX_HEIGHT_PT * sizeWeight(size);
  // Prefer the content-height fraction so S leaves room for a text row underneath on 1" labels.
  return Math.min(fromAbsolute, fromFraction, contentHeightPt * 0.9);
}

function barcodeWidthPt(columnWidth: number, heightPt: number, size: LabelContentSize): number {
  const estimated = heightPt * LABEL_BARCODE_ASPECT;
  const maxFraction = size === "large" ? 1 : size === "small" ? 0.55 : 0.75;
  return Math.min(columnWidth, columnWidth * maxFraction, Math.max(heightPt * 3, estimated));
}

function textSlotHeightPt(
  slot: Extract<LabelLayoutSlot, { kind: "text" }>,
  baseValueFontSizePt: number,
  columnWidth: number,
  pageHeightPt: number,
  measurer: LabelTextMeasurer,
): { heightPt: number; valueLines: string[]; valueFontSizePt: number; labelFontSizePt: number } {
  const weight = sizeWeight(slot.size);
  const valueFontSizePt = baseValueFontSizePt * weight;
  const labelFontSizePt = LABEL_LABEL_FONT_SIZE_PT * weight;
  const valueLines = wrapText(
    slot.line.value,
    columnWidth,
    valueFontSizePt,
    slot.line.key === LABEL_CONTENT_MATERIAL_ID,
    measurer,
  );
  const heightPt =
    labelFontSizePt +
    LABEL_VALUE_LINE_GAP_PT +
    valueLines.length * (valueFontSizePt + LABEL_VALUE_LINE_GAP_PT) +
    fieldGapPt(pageHeightPt);
  return { heightPt, valueLines, valueFontSizePt, labelFontSizePt };
}

interface PackGeometry {
  widthPt: number;
  heightPt: number;
  marginPt: number;
  contentWidthPt: number;
  contentHeightPt: number;
  columns: number;
  columnWidthPt: number;
}

function createPackGeometry(
  widthPt: number,
  heightPt: number,
  marginPt: number,
  columns: number,
): PackGeometry {
  const contentWidthPt = widthPt - marginPt * 2;
  return {
    widthPt,
    heightPt,
    marginPt,
    contentWidthPt,
    contentHeightPt: heightPt - marginPt * 2,
    columns,
    columnWidthPt: columnWidthPt(contentWidthPt, columns),
  };
}

function codeSlotHeightPt(
  slot: Extract<LabelLayoutSlot, { kind: "qr" | "barcode" }>,
  geometry: PackGeometry,
): number {
  if (slot.kind === "qr") {
    return (
      qrSizePt(
        geometry.columnWidthPt,
        geometry.contentHeightPt,
        geometry.contentWidthPt,
        geometry.columns,
        slot.size,
      ) + codeGapPt(geometry.heightPt)
    );
  }
  return barcodeHeightPt(slot.size, geometry.contentHeightPt) + codeGapPt(geometry.heightPt);
}

function estimateStackedTextHeightPt(
  slots: LabelLayoutSlot[],
  baseValueFontSizePt: number,
  geometry: PackGeometry,
  measurer: LabelTextMeasurer,
): number {
  return slots
    .filter((slot): slot is Extract<LabelLayoutSlot, { kind: "text" }> => slot.kind === "text")
    .reduce(
      (sum, slot) =>
        sum +
        textSlotHeightPt(
          slot,
          baseValueFontSizePt,
          geometry.columnWidthPt,
          geometry.heightPt,
          measurer,
        ).heightPt,
      0,
    );
}

function resolveValueFontSizePt(
  slots: LabelLayoutSlot[],
  geometry: PackGeometry,
  measurer: LabelTextMeasurer,
): number {
  const textSlots = slots.filter((slot) => slot.kind === "text");
  if (textSlots.length === 0) {
    return LABEL_DEFAULT_VALUE_FONT_SIZE_PT;
  }

  // Single column: codes consume vertical space. Multi-column: assume codes sit beside text.
  const codeHeightReserve =
    geometry.columns === 1
      ? slots.reduce((sum, slot) => {
          if (slot.kind === "qr" || slot.kind === "barcode") {
            return sum + codeSlotHeightPt(slot, geometry);
          }
          return sum;
        }, 0)
      : 0;
  const available = geometry.contentHeightPt - codeHeightReserve;

  let fontSizePt = LABEL_DEFAULT_VALUE_FONT_SIZE_PT;
  let estimated = estimateStackedTextHeightPt(slots, fontSizePt, geometry, measurer);
  if (estimated <= available) {
    return fontSizePt;
  }

  fontSizePt = Math.max(
    LABEL_MIN_FONT_SIZE_PT,
    Math.floor(
      available / textSlots.length -
        LABEL_LABEL_FONT_SIZE_PT -
        LABEL_VALUE_LINE_GAP_PT -
        fieldGapPt(geometry.heightPt),
    ),
  );

  while (fontSizePt > LABEL_MIN_FONT_SIZE_PT) {
    estimated = estimateStackedTextHeightPt(slots, fontSizePt, geometry, measurer);
    if (estimated <= available) {
      break;
    }
    fontSizePt -= 1;
  }

  return fontSizePt;
}

type MeasuredSlot =
  | {
      kind: "text";
      slot: Extract<LabelLayoutSlot, { kind: "text" }>;
      heightPt: number;
      valueLines: string[];
      valueFontSizePt: number;
      labelFontSizePt: number;
    }
  | {
      kind: "qr";
      slot: Extract<LabelLayoutSlot, { kind: "qr" }>;
      heightPt: number;
      sizePt: number;
    }
  | {
      kind: "barcode";
      slot: Extract<LabelLayoutSlot, { kind: "barcode" }>;
      heightPt: number;
      widthPt: number;
      barcodeHeight: number;
    };

function measureSlot(
  slot: LabelLayoutSlot,
  baseValueFontSizePt: number,
  geometry: PackGeometry,
  measurer: LabelTextMeasurer,
): MeasuredSlot {
  if (slot.kind === "text") {
    const measured = textSlotHeightPt(
      slot,
      baseValueFontSizePt,
      geometry.columnWidthPt,
      geometry.heightPt,
      measurer,
    );
    return { kind: "text", slot, ...measured };
  }
  if (slot.kind === "qr") {
    const sizePt = qrSizePt(
      geometry.columnWidthPt,
      geometry.contentHeightPt,
      geometry.contentWidthPt,
      geometry.columns,
      slot.size,
    );
    return { kind: "qr", slot, heightPt: sizePt + codeGapPt(geometry.heightPt), sizePt };
  }
  const barcodeHeight = barcodeHeightPt(slot.size, geometry.contentHeightPt);
  const widthPt = barcodeWidthPt(geometry.columnWidthPt, barcodeHeight, slot.size);
  return {
    kind: "barcode",
    slot,
    heightPt: barcodeHeight + codeGapPt(geometry.heightPt),
    widthPt,
    barcodeHeight,
  };
}

/** Fill column 0 top-to-bottom, then column 1, etc. */
function pickColumnIndex(
  measured: MeasuredSlot,
  columnUsedPt: number[],
  contentHeightPt: number,
): number {
  for (let index = 0; index < columnUsedPt.length; index += 1) {
    if (columnUsedPt[index]! + measured.heightPt <= contentHeightPt + 0.01) {
      return index;
    }
  }
  // Nothing fits: keep overflowing the last column.
  return columnUsedPt.length - 1;
}

interface PackedLayout {
  layout: LabelPageLayout;
  columnsUsed: number;
}

function packSlots(
  slots: LabelLayoutSlot[],
  geometry: PackGeometry,
  measurer: LabelTextMeasurer,
): PackedLayout {
  const valueFontSizePt = resolveValueFontSizePt(slots, geometry, measurer);
  const columnUsedPt = Array.from({ length: geometry.columns }, () => 0);
  const elements: LabelLayoutElement[] = [];

  for (const slot of slots) {
    const measured = measureSlot(slot, valueFontSizePt, geometry, measurer);
    const columnIndex = pickColumnIndex(measured, columnUsedPt, geometry.contentHeightPt);
    const columnLeftPt =
      geometry.marginPt + columnIndex * (geometry.columnWidthPt + LABEL_COLUMN_GAP_PT);
    const topPt = geometry.marginPt + columnUsedPt[columnIndex]!;

    if (measured.kind === "text") {
      elements.push({
        kind: "field",
        line: measured.slot.line,
        leftPt: columnLeftPt,
        topPt,
        widthPt: geometry.columnWidthPt,
        labelFontSizePt: measured.labelFontSizePt,
        valueFontSizePt: measured.valueFontSizePt,
        valueLines: measured.valueLines,
        valueBold: measured.slot.line.key === LABEL_CONTENT_MATERIAL_ID,
        align: measured.slot.align,
      });
    } else if (measured.kind === "qr") {
      elements.push({
        kind: "qr",
        payload: measured.slot.payload,
        leftPt: alignedLeftPt(
          columnLeftPt,
          geometry.columnWidthPt,
          measured.sizePt,
          measured.slot.align,
        ),
        topPt,
        sizePt: measured.sizePt,
        align: measured.slot.align,
      });
    } else {
      elements.push({
        kind: "barcode",
        payload: measured.slot.payload,
        leftPt: alignedLeftPt(
          columnLeftPt,
          geometry.columnWidthPt,
          measured.widthPt,
          measured.slot.align,
        ),
        topPt,
        widthPt: measured.widthPt,
        heightPt: measured.barcodeHeight,
        align: measured.slot.align,
      });
    }

    columnUsedPt[columnIndex]! += measured.heightPt;
  }

  return {
    layout: {
      widthPt: geometry.widthPt,
      heightPt: geometry.heightPt,
      marginPt: geometry.marginPt,
      valueFontSizePt,
      overflow: columnUsedPt.some((used) => used > geometry.contentHeightPt + 0.01),
      elements,
    },
    columnsUsed: columnUsedPt.filter((used) => used > 0).length,
  };
}

export function computeLabelPageLayout(
  template: LabelTemplate,
  slots: LabelLayoutSlot[],
  measurer: LabelTextMeasurer = createApproxTextMeasurer(),
): LabelPageLayout {
  const { widthPt, heightPt } = labelTemplateSizePoints(template.size);
  const marginPt = resolveLabelMarginPt(widthPt, heightPt);
  const maxColumns = resolveColumnCount(widthPt, heightPt);

  if (maxColumns === 1) {
    return packSlots(slots, createPackGeometry(widthPt, heightPt, marginPt, 1), measurer).layout;
  }

  // Wide labels: pack fill-first into columns. If everything fits in column 0,
  // re-pack as a single full-width stack so align (e.g. centered barcode) uses the whole tag.
  const multi = packSlots(
    slots,
    createPackGeometry(widthPt, heightPt, marginPt, maxColumns),
    measurer,
  );
  if (multi.columnsUsed <= 1) {
    return packSlots(slots, createPackGeometry(widthPt, heightPt, marginPt, 1), measurer).layout;
  }

  return multi.layout;
}
