import {
  LABEL_CONTENT_MATERIAL_ID,
  type LabelTemplate,
  labelTemplateSizePoints,
} from "@certtrace/types";

export interface LabelContentLine {
  key: string;
  label: string;
  value: string;
}

export type LabelLayoutSlot =
  | { kind: "text"; line: LabelContentLine }
  | { kind: "qr"; payload: string }
  | { kind: "barcode"; payload: string };

export const LABEL_MARGIN_PT = 18;
export const LABEL_MIN_FONT_SIZE_PT = 7;
export const LABEL_DEFAULT_VALUE_FONT_SIZE_PT = 12;
export const LABEL_LABEL_FONT_SIZE_PT = 9;
export const LABEL_QR_MAX_SIZE_PT = 96;
export const LABEL_BARCODE_MAX_HEIGHT_PT = 36;
const LABEL_FIELD_GAP_PT = 6;
export const LABEL_VALUE_LINE_GAP_PT = 2;

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
    }
  | {
      kind: "barcode";
      payload: string;
      leftPt: number;
      topPt: number;
      widthPt: number;
      heightPt: number;
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
    };

export interface LabelPageLayout {
  widthPt: number;
  heightPt: number;
  marginPt: number;
  valueFontSizePt: number;
  overflow: boolean;
  elements: LabelLayoutElement[];
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
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (measurer.widthOfText(candidate, fontSizePt, bold) <= maxWidthPt) {
      line = candidate;
      continue;
    }
    if (line.length > 0) {
      lines.push(line);
    }
    line = word;
  }

  if (line.length > 0) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

function qrSizePt(widthPt: number, heightPt: number, marginPt: number): number {
  const contentWidthPt = widthPt - marginPt * 2;
  return Math.min(LABEL_QR_MAX_SIZE_PT, contentWidthPt * 0.35, heightPt * 0.35);
}

function codeBlockHeightPt(slots: LabelLayoutSlot[], widthPt: number, heightPt: number, marginPt: number): number {
  const qrSize = qrSizePt(widthPt, heightPt, marginPt);
  return slots.reduce((sum, slot) => {
    if (slot.kind === "qr") {
      return sum + qrSize + 8;
    }
    if (slot.kind === "barcode") {
      return sum + LABEL_BARCODE_MAX_HEIGHT_PT + 8;
    }
    return sum;
  }, 0);
}

function estimateTextHeightPt(
  slots: LabelLayoutSlot[],
  valueFontSizePt: number,
  contentWidthPt: number,
  measurer: LabelTextMeasurer,
): number {
  return slots
    .filter((slot): slot is Extract<LabelLayoutSlot, { kind: "text" }> => slot.kind === "text")
    .reduce((sum, slot) => {
      const valueLines = wrapText(
        slot.line.value,
        contentWidthPt,
        valueFontSizePt,
        slot.line.key === LABEL_CONTENT_MATERIAL_ID,
        measurer,
      );
      return (
        sum +
        LABEL_LABEL_FONT_SIZE_PT +
        LABEL_VALUE_LINE_GAP_PT +
        valueLines.length * (valueFontSizePt + LABEL_VALUE_LINE_GAP_PT) +
        LABEL_FIELD_GAP_PT
      );
    }, 0);
}

function resolveValueFontSizePt(
  slots: LabelLayoutSlot[],
  widthPt: number,
  heightPt: number,
  marginPt: number,
  measurer: LabelTextMeasurer,
): number {
  const textSlots = slots.filter((slot) => slot.kind === "text");
  if (textSlots.length === 0) {
    return LABEL_DEFAULT_VALUE_FONT_SIZE_PT;
  }

  const contentWidthPt = widthPt - marginPt * 2;
  const available =
    heightPt - marginPt * 2 - codeBlockHeightPt(slots, widthPt, heightPt, marginPt);
  let fontSizePt = LABEL_DEFAULT_VALUE_FONT_SIZE_PT;
  let estimated = estimateTextHeightPt(slots, fontSizePt, contentWidthPt, measurer);

  if (estimated <= available) {
    return fontSizePt;
  }

  fontSizePt = Math.max(
    LABEL_MIN_FONT_SIZE_PT,
    Math.floor(
      available / textSlots.length - LABEL_LABEL_FONT_SIZE_PT - LABEL_VALUE_LINE_GAP_PT - LABEL_FIELD_GAP_PT,
    ),
  );

  while (fontSizePt > LABEL_MIN_FONT_SIZE_PT) {
    estimated = estimateTextHeightPt(slots, fontSizePt, contentWidthPt, measurer);
    if (estimated <= available) {
      break;
    }
    fontSizePt -= 1;
  }

  return fontSizePt;
}

export function computeLabelPageLayout(
  template: LabelTemplate,
  slots: LabelLayoutSlot[],
  measurer: LabelTextMeasurer = createApproxTextMeasurer(),
): LabelPageLayout {
  const { widthPt, heightPt } = labelTemplateSizePoints(template.size);
  const marginPt = LABEL_MARGIN_PT;
  const contentWidthPt = widthPt - marginPt * 2;
  const valueFontSizePt = resolveValueFontSizePt(slots, widthPt, heightPt, marginPt, measurer);
  const qrSize = qrSizePt(widthPt, heightPt, marginPt);

  const elements: LabelLayoutElement[] = [];
  let cursorTopPt = marginPt;

  for (const slot of slots) {
    if (slot.kind === "text") {
      const valueLines = wrapText(
        slot.line.value,
        contentWidthPt,
        valueFontSizePt,
        slot.line.key === LABEL_CONTENT_MATERIAL_ID,
        measurer,
      );
      elements.push({
        kind: "field",
        line: slot.line,
        leftPt: marginPt,
        topPt: cursorTopPt,
        widthPt: contentWidthPt,
        labelFontSizePt: LABEL_LABEL_FONT_SIZE_PT,
        valueFontSizePt,
        valueLines,
        valueBold: slot.line.key === LABEL_CONTENT_MATERIAL_ID,
      });
      cursorTopPt +=
        LABEL_LABEL_FONT_SIZE_PT +
        LABEL_VALUE_LINE_GAP_PT +
        valueLines.length * (valueFontSizePt + LABEL_VALUE_LINE_GAP_PT) +
        LABEL_FIELD_GAP_PT;
      continue;
    }

    if (slot.kind === "qr") {
      elements.push({
        kind: "qr",
        payload: slot.payload,
        leftPt: marginPt,
        topPt: cursorTopPt,
        sizePt: qrSize,
      });
      cursorTopPt += qrSize + 8;
      continue;
    }

    elements.push({
      kind: "barcode",
      payload: slot.payload,
      leftPt: marginPt,
      topPt: cursorTopPt,
      widthPt: contentWidthPt,
      heightPt: LABEL_BARCODE_MAX_HEIGHT_PT,
    });
    cursorTopPt += LABEL_BARCODE_MAX_HEIGHT_PT + 8;
  }

  return {
    widthPt,
    heightPt,
    marginPt,
    valueFontSizePt,
    overflow: cursorTopPt > heightPt - marginPt,
    elements,
  };
}
