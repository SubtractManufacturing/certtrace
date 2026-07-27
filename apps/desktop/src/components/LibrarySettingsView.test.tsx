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
  updateLibraryConfigPartial,
  updateLibraryFieldSchema,
  updateLibraryNamingRules,
  updateLibraryWordLists,
} from "../lib/library-client";
import { LibrarySettingsView } from "./LibrarySettingsView";

vi.mock("../lib/library-client", () => ({
  updateLibraryConfigPartial: vi.fn(),
  updateLibraryFieldSchema: vi.fn(),
  updateLibraryNamingRules: vi.fn(),
  updateLibraryWordLists: vi.fn(),
}));

describe("LibrarySettingsView", () => {
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

    render(<LibrarySettingsView library={library} onLibraryUpdated={() => undefined} />);

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
});
