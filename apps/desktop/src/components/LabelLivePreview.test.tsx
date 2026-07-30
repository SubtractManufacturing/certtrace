import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabelLivePreview } from "./LabelLivePreview";

const material = {
  version: 2 as const,
  id: "AL-falcon-104",
  fields: {
    family: "aluminum",
    alloy: "6061",
    temper: "t6511",
  },
  identifiers: {},
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
};

describe("LabelLivePreview", () => {
  it("renders QR and barcode images when included in the template", async () => {
    render(
      <LabelLivePreview
        template={{
          id: "codes",
          name: "Codes",
          size: { kind: "catalog", catalogId: "4x6" },
          displayUnit: "in",
          contentKeys: ["family", "qr", "barcode"],
        }}
        material={material}
        fieldSchema={defaultFieldSchemaV1}
      />,
    );

    expect(await screen.findByAltText(/QR code for AL-falcon-104/i)).toBeTruthy();
    expect(screen.getByAltText(/Barcode for AL-falcon-104/i)).toBeTruthy();

    await waitFor(() => {
      const qr = screen.getByAltText(/QR code for AL-falcon-104/i) as HTMLImageElement;
      expect(qr.src.startsWith("data:image/png")).toBe(true);
    });

    const barcode = screen.getByAltText(/Barcode for AL-falcon-104/i) as HTMLImageElement;
    expect(barcode.src.startsWith("data:image/svg+xml")).toBe(true);
  });
});
