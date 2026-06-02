import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FileSystem } from "@certtrace/file-storage";
import { createNodeFileSystem } from "@certtrace/file-storage/node";
import {
  CERTTRACE_DIR,
  LABELS_DIR,
  LIBRARY_JSON,
  LIBRARY_README,
  MATERIALS_DIR,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
} from "@certtrace/types";
import { createLibrary, openLibrary } from "../src/index.js";

describe("createLibrary", () => {
  it("creates a named library folder with readme and contract", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-lib-"));

    try {
      const library = await createLibrary(fs, parentDir, "Main Shop Materials");

      expect(library.config.name).toBe("Main Shop Materials");
      expect(library.paths.root).toBe(join(parentDir, "Main Shop Materials"));
      expect(library.paths.certtrace.endsWith(CERTTRACE_DIR)).toBe(true);

      const readme = await readFile(join(library.paths.root, LIBRARY_README), "utf8");
      expect(readme).toContain("CertTrace material library");
      expect(readme).toContain("Main Shop Materials");

      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.config.idStrategy).toBe("material-animal-number");
      expect(reopened.namingRules.strategies.length).toBeGreaterThan(0);
      expect(Object.keys(reopened.wordLists.lists)).toContain("animals");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates a library when the parent directory does not exist yet", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-new-parent-"));

    try {
      const library = await createLibrary(fs, parentDir, "Nested Library");
      expect(library.paths.root).toBe(join(parentDir, "Nested Library"));
      const reopened = await openLibrary(fs, library.paths.root);
      expect(reopened.config.name).toBe("Nested Library");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates a library when readdir throws a Windows missing-path string", async () => {
    const nodeFs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-win-missing-"));
    const libraryRoot = join(parentDir, "Main Shop Materials");
    const fs: FileSystem = {
      ...nodeFs,
      readdir: async (path) => {
        if (path === libraryRoot) {
          throw `failed to read directory at path: ${libraryRoot} with error: The system cannot find the path specified. (os error 3)`;
        }
        return nodeFs.readdir(path);
      },
    };

    try {
      const library = await createLibrary(fs, parentDir, "Main Shop Materials");

      expect(library.paths.root).toBe(libraryRoot);
      const readme = await readFile(join(library.paths.root, LIBRARY_README), "utf8");
      expect(readme).toContain("Main Shop Materials");
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("creates expected relative paths inside the library folder", async () => {
    const fs = createNodeFileSystem();
    const parentDir = await mkdtemp(join(tmpdir(), "certtrace-lib-"));

    try {
      const library = await createLibrary(fs, parentDir, "QA Archive");
      const opened = await openLibrary(fs, library.paths.root);

      expect(opened.paths.libraryJson.endsWith(LIBRARY_JSON)).toBe(true);
      expect(opened.paths.namingRulesJson.endsWith(NAMING_RULES_JSON)).toBe(true);
      expect(opened.paths.wordListsJson.endsWith(WORD_LISTS_JSON)).toBe(true);
      expect(opened.paths.materials.endsWith(MATERIALS_DIR)).toBe(true);
      expect(opened.paths.labels.endsWith(LABELS_DIR)).toBe(true);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });
});
