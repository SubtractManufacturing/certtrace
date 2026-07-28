import type { OpenLibraryResult } from "@certtrace/library-engine";
import {
  createDefaultLibraryConfigV1,
  defaultFieldSchemaV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
} from "@certtrace/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeLibrarySchemaDefinition,
  updateLibraryConfigPartial,
  updateLibraryFieldSchema,
  updateLibraryNamingRules,
  updateLibraryWordLists,
} from "../lib/library-client";
import { AdvancedLibrarySettingsView } from "./AdvancedLibrarySettingsView";

vi.mock("../lib/library-client", () => ({
  removeLibrarySchemaDefinition: vi.fn(),
  updateLibraryConfigPartial: vi.fn(),
  updateLibraryFieldSchema: vi.fn(),
  updateLibraryNamingRules: vi.fn(),
  updateLibraryWordLists: vi.fn(),
}));

describe("AdvancedLibrarySettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves edited fields through the library client", async () => {
    const library = {
      config: createDefaultLibraryConfigV1("Main"),
      namingRules: defaultNamingRulesV1,
      wordLists: defaultWordListsV1,
      fieldSchema: defaultFieldSchemaV1,
      paths: { root: "/libraries/main" },
      fs: {},
    } as never;
    vi.mocked(updateLibraryNamingRules).mockResolvedValue(library);
    vi.mocked(updateLibraryWordLists).mockResolvedValue(library);
    vi.mocked(updateLibraryConfigPartial).mockResolvedValue(library);
    vi.mocked(updateLibraryFieldSchema).mockResolvedValue(library);

    render(<AdvancedLibrarySettingsView library={library} onLibraryUpdated={() => undefined} />);

    const label = screen.getByLabelText("Label for field family");
    await userEvent.clear(label);
    await userEvent.type(label, "Stock family");
    await userEvent.click(screen.getByRole("button", { name: "Save library settings" }));

    expect(updateLibraryFieldSchema).toHaveBeenCalledWith(
      library,
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ key: "family", label: "Stock family" }),
        ]),
      }),
    );
  });

  it("persists pending schema edits before applying a removal choice", async () => {
    const library = {
      config: createDefaultLibraryConfigV1("Main"),
      namingRules: defaultNamingRulesV1,
      wordLists: defaultWordListsV1,
      fieldSchema: defaultFieldSchemaV1,
      paths: { root: "/libraries/main" },
      fs: {},
    } as unknown as OpenLibraryResult;
    const schemaSaved = { ...library };
    const removed = {
      ...library,
      fieldSchema: {
        ...defaultFieldSchemaV1,
        fields: defaultFieldSchemaV1.fields.map((field) =>
          field.key === "supplier" ? { ...field, disabled: true } : field,
        ),
      },
    } as OpenLibraryResult;
    vi.mocked(updateLibraryFieldSchema).mockResolvedValue(schemaSaved);
    vi.mocked(removeLibrarySchemaDefinition).mockResolvedValue(removed);

    render(<AdvancedLibrarySettingsView library={library} onLibraryUpdated={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Remove Supplier" }));
    await userEvent.click(screen.getByRole("button", { name: "Disable new entries" }));

    expect(updateLibraryFieldSchema).toHaveBeenCalledWith(library, defaultFieldSchemaV1);
    expect(removeLibrarySchemaDefinition).toHaveBeenCalledWith(schemaSaved, {
      definitionType: "field",
      key: "supplier",
      strategy: { type: "disable" },
    });
  });
});
