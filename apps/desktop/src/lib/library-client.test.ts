import { createLibrary, updateFieldSchema } from "@certtrace/library-engine";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLibraryFieldOption,
  createLibraryWithOptions,
  pickParentFolder,
} from "./library-client";
import { allowLibraryDirectory } from "./library-scope";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@certtrace/library-engine", () => ({
  createLibrary: vi.fn(),
  createMaterial: vi.fn(),
  listMaterialAttachments: vi.fn(),
  listMaterials: vi.fn(),
  openLibrary: vi.fn(),
  updateLibraryConfig: vi.fn(),
  updateFieldSchema: vi.fn(),
  updateMaterial: vi.fn(),
  updateNamingRules: vi.fn(),
  updateWordLists: vi.fn(),
}));

vi.mock("@certtrace/types", () => ({
  joinPath: (...parts: string[]) => parts.join("/"),
  libraryFolderName: (name: string) => name,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("./app-settings-client", () => ({
  recordRecentLibrary: vi.fn(),
}));

vi.mock("./library-scope", () => ({
  allowLibraryDirectory: vi.fn(),
}));

describe("library-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the picked parent folder without granting scope during selection", async () => {
    vi.mocked(open).mockResolvedValue("C:\\Users\\jkkic\\Documents");

    await expect(pickParentFolder("Choose a folder")).resolves.toBe("C:\\Users\\jkkic\\Documents");

    expect(allowLibraryDirectory).not.toHaveBeenCalled();
  });

  it("grants non-recursive access to the parent when creating a library", async () => {
    vi.mocked(createLibrary).mockResolvedValue({
      paths: { root: "C:\\Users\\jkkic\\Documents\\Main Shop" },
      config: { name: "Main Shop" },
    } as never);

    await createLibraryWithOptions("C:\\Users\\jkkic\\Documents", { name: "Main Shop" });

    expect(allowLibraryDirectory).toHaveBeenNthCalledWith(1, "C:\\Users\\jkkic\\Documents", {
      recursive: false,
    });
    expect(allowLibraryDirectory).toHaveBeenNthCalledWith(
      2,
      "C:\\Users\\jkkic\\Documents/Main Shop",
      { recursive: true },
    );
    expect(allowLibraryDirectory).toHaveBeenNthCalledWith(
      3,
      "C:\\Users\\jkkic\\Documents\\Main Shop",
      { recursive: true },
    );
  });

  it("persists a confirmed option and makes it available for the selected dependency", async () => {
    const library = {
      fieldSchema: {
        version: 1,
        fields: [
          {
            key: "family",
            label: "Material",
            type: "single_select",
            required: false,
            filterable: true,
            options: [{ id: "aluminum", label: "Aluminum" }],
          },
          {
            key: "alloy",
            label: "Alloy",
            type: "single_select",
            required: false,
            filterable: true,
            options: [{ id: "6061", label: "6061" }],
            dependsOn: {
              fieldKey: "family",
              filterOptionsBy: { aluminum: ["6061"] },
            },
          },
        ],
        identifierKinds: [],
        attachmentKinds: [],
      },
    } as never;

    await expect(
      addLibraryFieldOption(library, "alloy", "5052 H32", { family: "aluminum" }),
    ).resolves.toEqual({ id: "5052_h32", label: "5052 H32" });

    const savedSchema = vi.mocked(updateFieldSchema).mock.calls[0]?.[1];
    const savedAlloy = savedSchema?.fields.find((field) => field.key === "alloy");
    expect(savedAlloy?.options).toContainEqual({ id: "5052_h32", label: "5052 H32" });
    expect(savedAlloy?.dependsOn?.filterOptionsBy?.aluminum).toEqual(["6061", "5052_h32"]);
  });
});
