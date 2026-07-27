import type { MaterialMetadataV1 } from "@certtrace/types";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

const LABEL_WIDTH = 288;
const LABEL_HEIGHT = 144;
const MARGIN = 12;

function fieldText(material: MaterialMetadataV1, key: string): string {
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

export interface StandardQrLabelOptions {
  includeMaterial?: boolean;
  includeLocation?: boolean;
}

export async function generateStandardQrLabelPdf(
  material: MaterialMetadataV1,
  options: StandardQrLabelOptions = {},
): Promise<Uint8Array> {
  const familyOrAlloy = fieldText(material, "alloy") || fieldText(material, "family");
  const location = fieldText(material, "storage_location");
  const includeMaterial = options.includeMaterial ?? familyOrAlloy.length > 0;
  const includeLocation = options.includeLocation ?? location.length > 0;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const qrSize = 72;
  const qrDataUrl = await QRCode.toDataURL(material.id, {
    margin: 0,
    width: qrSize * 4,
    errorCorrectionLevel: "M",
  });
  const qrImage = await pdf.embedPng(qrDataUrl);

  page.drawImage(qrImage, {
    x: MARGIN,
    y: LABEL_HEIGHT - MARGIN - qrSize,
    width: qrSize,
    height: qrSize,
  });

  const textX = MARGIN + qrSize + 12;
  let textY = LABEL_HEIGHT - MARGIN - 14;

  page.drawText(material.id, {
    x: textX,
    y: textY,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  textY -= 18;

  if (includeMaterial) {
    page.drawText(familyOrAlloy, {
      x: textX,
      y: textY,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    textY -= 16;
  }

  if (includeLocation) {
    page.drawText(location, {
      x: textX,
      y: textY,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
  }

  return pdf.save();
}
