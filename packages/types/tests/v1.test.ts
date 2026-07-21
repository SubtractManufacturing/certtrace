import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LIBRARY_JSON, MATERIALS_DIR, NAMING_RULES_JSON, WORD_LISTS_JSON } from "../src/paths.js";
import {
  libraryConfigV1Schema,
  materialMetadataV1Schema,
  namingRulesV1Schema,
  wordListsV1Schema,
} from "../src/schemas/v1.js";
import {
  createDefaultLibraryConfigV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
} from "../src/seeds/v1.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));
}

describe("libraryConfigV1Schema", () => {
  it("validates a small library fixture", () => {
    const parsed = libraryConfigV1Schema.parse(
      readFixture("fixtures/libraries/small/.certtrace/library.json"),
    );
    expect(parsed.name).toBe("Main Shop Materials");
  });

  it("validates default seed config", () => {
    expect(createDefaultLibraryConfigV1("QA Archive").name).toBe("QA Archive");
  });
});

describe("namingRulesV1Schema", () => {
  it("validates shipped default presets", () => {
    expect(namingRulesV1Schema.parse(defaultNamingRulesV1).activeStrategyId).toBe(
      "material-animal-number",
    );
  });

  it("rejects activeStrategyId that does not exist", () => {
    const result = namingRulesV1Schema.safeParse({
      ...defaultNamingRulesV1,
      activeStrategyId: "missing-strategy",
    });
    expect(result.success).toBe(false);
  });
});

describe("wordListsV1Schema", () => {
  it("validates default word lists", () => {
    expect(Object.keys(wordListsV1Schema.parse(defaultWordListsV1).lists)).toContain("animals");
  });
});

describe("materialMetadataV1Schema", () => {
  it("validates a material fixture", () => {
    const parsed = materialMetadataV1Schema.parse(
      readFixture("fixtures/libraries/small/materials/AL-falcon-104/metadata.json"),
    );
    expect(parsed.id).toBe("AL-falcon-104");
  });

  it("rejects invalid material ids", () => {
    const result = materialMetadataV1Schema.safeParse({
      version: 1,
      id: "bad id with spaces",
      material: "",
      supplier: "",
      heat: "",
      location: "",
      tags: [],
      notes: "",
      barcode: "bad id with spaces",
      createdAt: "2026-05-28T12:00:00.000Z",
      updatedAt: "2026-05-28T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("library folder contract", () => {
  it("documents expected top-level paths", () => {
    expect(LIBRARY_JSON).toBe(".certtrace/library.json");
    expect(NAMING_RULES_JSON).toBe(".certtrace/naming-rules.json");
    expect(WORD_LISTS_JSON).toBe(".certtrace/word-lists.json");
    expect(MATERIALS_DIR).toBe("materials");
  });
});
