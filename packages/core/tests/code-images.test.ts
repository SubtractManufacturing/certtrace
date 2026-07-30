import { describe, expect, it } from "vitest";
import {
  renderBarcodePreviewDataUrl,
  renderBarcodePngBytes,
  renderQrDataUrl,
} from "../src/labels/code-images.js";

describe("label code images", () => {
  it("renders a QR code data URL", async () => {
    const dataUrl = await renderQrDataUrl("AL-falcon-104");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("renders a barcode preview SVG data URL", () => {
    const dataUrl = renderBarcodePreviewDataUrl("AL-falcon-104");
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(dataUrl.split(",")[1] ?? "")).toContain("<svg");
  });

  it("renders barcode PNG bytes for PDF embedding", async () => {
    const bytes = await renderBarcodePngBytes("AL-falcon-104");
    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });
});
