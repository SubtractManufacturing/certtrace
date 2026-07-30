import bwipjs from "bwip-js";
import QRCode from "qrcode";

const DEFAULT_QR_SIZE_PX = 128;

interface BarcodeRenderOptions {
  bcid: "code128";
  text: string;
  scale: number;
  height: number;
  includetext: boolean;
}

const BARCODE_RENDER_OPTIONS: Omit<BarcodeRenderOptions, "text"> = {
  bcid: "code128",
  scale: 2,
  height: 10,
  includetext: false,
};

type BwipBarcodeRenderer = {
  toBuffer?: (opts: BarcodeRenderOptions) => Promise<Uint8Array>;
  toCanvas?: (canvas: HTMLCanvasElement, opts: BarcodeRenderOptions) => HTMLCanvasElement;
  toSVG: (opts: BarcodeRenderOptions) => string;
};

function barcodeOptions(payload: string): BarcodeRenderOptions {
  return { ...BARCODE_RENDER_OPTIONS, text: payload };
}

export async function renderQrDataUrl(
  payload: string,
  widthPx = DEFAULT_QR_SIZE_PX,
): Promise<string> {
  return QRCode.toDataURL(payload, {
    margin: 0,
    width: widthPx,
    errorCorrectionLevel: "M",
  });
}

/** SVG data URL for HTML previews (works in browser and test environments). */
export function renderBarcodePreviewDataUrl(payload: string): string {
  const svg = (bwipjs as unknown as BwipBarcodeRenderer).toSVG(barcodeOptions(payload));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** PNG bytes for PDF embedding (Node buffer or browser canvas). */
export async function renderBarcodePngBytes(payload: string): Promise<Uint8Array> {
  const options = barcodeOptions(payload);
  const renderer = bwipjs as unknown as BwipBarcodeRenderer;

  if (typeof renderer.toBuffer === "function") {
    return new Uint8Array(await renderer.toBuffer(options));
  }

  if (typeof document !== "undefined" && typeof renderer.toCanvas === "function") {
    const canvas = document.createElement("canvas");
    renderer.toCanvas(canvas, options);
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error("Barcode rendering is not supported in this environment");
}
