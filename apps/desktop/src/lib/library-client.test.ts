import {
  addFieldOption,
  createLibrary,
  openLibrary,
  removeSchemaDefinition,
  updateFieldSchema,
} from "@certtrace/library-engine";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLibraryFieldOption,
  createLibraryWithOptions,
  deleteLibraryFolder,
  pickParentFolder,
  removeLibrarySchemaDefinition,
  updateLibraryFieldSchema,
} from "./library-client";
import { allowLibraryDirectory } from "./library-scope";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@certtrace/library-engine", () => ({
  addFieldOption: vi.fn(),
  createLibrary: vi.fn(),
  createMaterial: vi.fn(),
  listMaterialAttachments: vi.fn(),
  listMaterials: vi.fn(),
  openLibrary: vi.fn(),
  removeSchemaDefinition: vi.fn(),
  updateFieldSchema: vi.fn(),
  updateLibraryConfig: vi.fn(),
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

  it("delegates confirmed options to the library engine", async () => {
    const library = { fieldSchema: { fields: [] } } as never;
    const input = {
      fieldKey: "alloy",
      label: "5052 H32",
      currentValues: { family: "aluminum" },
    };
    const result = {
      option: { id: "5052_h32", label: "5052 H32" },
      fieldSchema: { version: 2, fields: [], identifierKinds: [], attachmentKinds: [] },
    } as never;
    vi.mocked(addFieldOption).mockResolvedValue(result);

    await expect(addLibraryFieldOption(library, input)).resolves.toBe(result);
    expect(addFieldOption).toHaveBeenCalledWith(library, input);
  });

  it("persists a field schema through the library engine and reloads the library", async () => {
    const library = {
      fs: {},
      paths: { root: "/libraries/main" },
      fieldSchema: { version: 2, fields: [], identifierKinds: [], attachmentKinds: [] },
    } as never;
    const schema = {
      version: 2,
      fields: [],
      identifierKinds: [
        { key: "mill_cert", label: "Mill cert", required: false, filterable: true },
      ],
      attachmentKinds: [],
    } as never;
    const reopened = {
      fs: {},
      paths: { root: "/libraries/main" },
      fieldSchema: schema,
    } as never;
    vi.mocked(openLibrary).mockResolvedValue(reopened);

    await expect(updateLibraryFieldSchema(library, schema)).resolves.toBe(reopened);
    expect(updateFieldSchema).toHaveBeenCalledWith(library, schema);
    expect(openLibrary).toHaveBeenCalledWith(expect.any(Object), "/libraries/main");
  });

  it("applies a schema removal through the engine and reloads the library", async () => {
    const library = {
      fs: {},
      paths: { root: "/libraries/main" },
    } as never;
    const input = {
      definitionType: "field",
      key: "supplier",
      strategy: { type: "disable" },
    } as const;
    const reopened = {
      fs: {},
      paths: { root: "/libraries/main" },
    } as never;
    vi.mocked(removeSchemaDefinition).mockResolvedValue({} as never);
    vi.mocked(openLibrary).mockResolvedValue(reopened);

    await expect(removeLibrarySchemaDefinition(library, input)).resolves.toBe(reopened);
    expect(removeSchemaDefinition).toHaveBeenCalledWith(library, input);
  });

  it("deletes an existing library folder from disk", async () => {
    const { remove } = await import("@tauri-apps/plugin-fs");

    await deleteLibraryFolder("/libraries/main");

    expect(allowLibraryDirectory).toHaveBeenCalledWith("/libraries/main", { recursive: true });
    expect(remove).toHaveBeenCalledWith("/libraries/main", { recursive: true });
  });

  it("treats a missing library folder as already deleted", async () => {
    const { remove } = await import("@tauri-apps/plugin-fs");
    const missingPathError =
      "failed to get metadata of path: /Users/jacobm/Documents/Sandbox with error: No such file or directory (os error 2)";
    vi.mocked(allowLibraryDirectory).mockRejectedValueOnce(missingPathError);

    await expect(deleteLibraryFolder("/Users/jacobm/Documents/Sandbox")).resolves.toBeUndefined();

    expect(remove).not.toHaveBeenCalled();
  });
});
