import type { OpenLibraryResult } from "@certtrace/library-engine";
import { createDefaultLibraryConfigV1, defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateLibraryFieldSchema } from "../lib/library-client";
import { LibrarySettingsView } from "./LibrarySettingsView";

vi.mock("../lib/library-client", () => ({
  updateLibraryFieldSchema: vi.fn(),
  updateLibraryConfigPartial: vi.fn(),
  fetchMaterials: vi.fn().mockResolvedValue([]),
}));

const sampleLibrary = {
  paths: { root: "/tmp/shop", materials: "/tmp/shop/materials" },
  config: createDefaultLibraryConfigV1("Main Shop"),
  fieldSchema: defaultFieldSchemaV1,
} as OpenLibraryResult;

describe("LibrarySettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists column picker changes from library settings", async () => {
    vi.mocked(updateLibraryFieldSchema).mockResolvedValue(sampleLibrary);

    render(
      <LibrarySettingsView
        library={sampleLibrary}
        onOpenAdvancedSettings={() => undefined}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Expand material columns/i }));
    await userEvent.click(screen.getByLabelText("Alloy column"));
    await userEvent.click(screen.getByLabelText("Notes column"));
    await userEvent.click(screen.getByLabelText("Heat Number column"));
    await userEvent.click(screen.getByLabelText("Identifiers column"));
    await userEvent.click(screen.getByRole("button", { name: /Save columns/i }));

    expect(updateLibraryFieldSchema).toHaveBeenCalledWith(
      sampleLibrary,
      expect.objectContaining({
        tableColumns: expect.arrayContaining([
          { kind: "field", key: "notes" },
          { kind: "identifier", key: "heat_number" },
        ]),
      }),
    );
  });

  it("collapses material columns by default", () => {
    render(
      <LibrarySettingsView
        library={sampleLibrary}
        onOpenAdvancedSettings={() => undefined}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    const expandButton = screen.getByRole("button", { name: /Expand material columns/i });
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps advanced settings visible below the columns section", () => {
    render(
      <LibrarySettingsView
        library={sampleLibrary}
        onOpenAdvancedSettings={() => undefined}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Material columns" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Label Templates" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Advanced settings/i })).toBeTruthy();
    expect(
      within(screen.getByRole("button", { name: /Advanced settings/i })).getByText(
        "Material schema, ID strategies, and word lists.",
      ),
    ).toBeTruthy();
  });

  it("collapses Label Templates by default", () => {
    render(
      <LibrarySettingsView
        library={sampleLibrary}
        onOpenAdvancedSettings={() => undefined}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Expand Label Templates/i }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("expands Label Templates when deep-linked from Label preview", () => {
    render(
      <LibrarySettingsView
        library={sampleLibrary}
        expandLabelTemplates
        onOpenAdvancedSettings={() => undefined}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: /Collapse Label Templates/i })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
});
