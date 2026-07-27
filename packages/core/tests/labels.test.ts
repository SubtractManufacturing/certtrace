import type { MaterialMetadataV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { generateStandardQrLabelPdf } from "../src/labels/standard-qr.js";

const material: MaterialMetadataV1 = {
  version: 1,
  id: "AL-falcon-104",
  fields: {
    family: "aluminum",
    alloy: "6061",
    storage_location: "Rack B2",
  },
  identifiers: {
    heat_number: "A4921",
  },
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

describe("generateStandardQrLabelPdf", () => {
  it("generates a non-empty PDF document", async () => {
    const pdf = await generateStandardQrLabelPdf(material);

    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });

  it("omits optional lines when disabled", async () => {
    const pdf = await generateStandardQrLabelPdf(material, {
      includeMaterial: false,
      includeLocation: false,
    });

    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
