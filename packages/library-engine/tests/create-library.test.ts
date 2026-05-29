import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeFileSystem } from "@certtrace/file-storage";
import {
  CERTTRACE_DIR,
  LABELS_DIR,
  LIBRARY_JSON,
  MATERIALS_DIR,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
} from "@certtrace/types";
import { createLibrary, openLibrary } from "../src/index.js";

describe("createLibrary", () => {
  it("writes the library folder contract", async () => {
    const fs = createNodeFileSystem();
    const root = await mkdtemp(join(tmpdir(), "certtrace-lib-"));

    try {
      const library = await createLibrary(fs, root, "Main Shop Materials");

      expect(library.config.name).toBe("Main Shop Materials");
      expect(library.paths.certtrace.endsWith(CERTTRACE_DIR)).toBe(true);

      const reopened = await openLibrary(fs, root);
      expect(reopened.config.idStrategy).toBe("material-animal-number");
      expect(reopened.namingRules.strategies.length).toBeGreaterThan(0);
      expect(Object.keys(reopened.wordLists.lists)).toContain("animals");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates expected relative paths", async () => {
    const fs = createNodeFileSystem();
    const root = await mkdtemp(join(tmpdir(), "certtrace-lib-"));

    try {
      await createLibrary(fs, root, "QA Archive");
      const opened = await openLibrary(fs, root);

      expect(opened.paths.libraryJson.endsWith(LIBRARY_JSON)).toBe(true);
      expect(opened.paths.namingRulesJson.endsWith(NAMING_RULES_JSON)).toBe(true);
      expect(opened.paths.wordListsJson.endsWith(WORD_LISTS_JSON)).toBe(true);
      expect(opened.paths.materials.endsWith(MATERIALS_DIR)).toBe(true);
      expect(opened.paths.labels.endsWith(LABELS_DIR)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
