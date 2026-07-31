import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FIELD_SCHEMA_JSON,
  LIBRARY_JSON,
  MATERIALS_DIR,
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
} from "../src/paths.js";
import {
  fieldSchemaV1Schema,
  libraryConfigV1Schema,
  materialMetadataV1Schema,
  namingRulesV1Schema,
  SCHEMA_VERSION,
  wordListsV1Schema,
} from "../src/schemas/v1.js";
import {
  createDefaultLibraryConfigV1,
  defaultFieldSchemaV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
} from "../src/seeds/v1.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));
}

describe("libraryConfigV1Schema", () => {
  it("validates default seed config with starter Label Templates", () => {
    const parsed = libraryConfigV1Schema.parse(createDefaultLibraryConfigV1("QA Archive"));
    expect(parsed.name).toBe("QA Archive");
    expect(parsed.defaultLabelTemplateId).toBe("starter-4x6");
    expect(parsed.labelTemplates.map((template) => template.id)).toEqual([
      "starter-4x6",
      "starter-letter",
      "starter-3x1",
    ]);
  });

  it("rejects a default Label Template id that is missing", () => {
    const seed = createDefaultLibraryConfigV1("QA Archive");
    const result = libraryConfigV1Schema.safeParse({
      ...seed,
      defaultLabelTemplateId: "missing",
    });
    expect(result.success).toBe(false);
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

describe("fieldSchemaV1Schema", () => {
  it("validates default field schema seed with Family labeled Material", () => {
    const parsed = fieldSchemaV1Schema.parse(defaultFieldSchemaV1);
    const family = parsed.fields.find((field) => field.key === "family");
    expect(family?.label).toBe("Material");
    expect(family?.type).toBe("single_select");
    expect(parsed.fields.filter((field) => field.filterable).map((field) => field.key)).toEqual([
      "family",
      "alloy",
      "temper",
      "shape",
      "supplier",
      "traceability_type",
      "date_received",
      "storage_location",
    ]);
    expect(parsed.fields.find((field) => field.key === "notes")?.filterable).toBe(false);
    expect(parsed.identifierKinds.map((kind) => kind.key)).toEqual([
      "heat_number",
      "lot_number",
      "purchase_order",
    ]);
    expect(parsed.identifierKinds.every((kind) => kind.filterable)).toBe(true);
    expect(parsed.attachmentKinds.map((kind) => kind.key)).toEqual([
      "mtr",
      "heat_cert",
      "coc",
      "other",
    ]);
    expect(parsed.tableColumns).toEqual([
      { kind: "id" },
      { kind: "field", key: "family" },
      { kind: "field", key: "alloy" },
      { kind: "field", key: "temper" },
      { kind: "field", key: "supplier" },
      { kind: "field", key: "storage_location" },
      { kind: "attachments" },
      { kind: "identifiers" },
    ]);
  });

  it("rejects select fields without options", () => {
    const result = fieldSchemaV1Schema.safeParse({
      version: SCHEMA_VERSION,
      fields: [
        {
          key: "family",
          label: "Material",
          type: "single_select",
          required: false,
          filterable: true,
        },
      ],
      identifierKinds: [],
      attachmentKinds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects reserved system keys as field definitions", () => {
    const result = fieldSchemaV1Schema.safeParse({
      version: SCHEMA_VERSION,
      fields: [
        {
          key: "id",
          label: "ID",
          type: "text",
          required: true,
          filterable: true,
        },
      ],
      identifierKinds: [],
      attachmentKinds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("materialMetadataV1Schema", () => {
  it("validates material metadata at the current schema version", () => {
    const fixture = readFixture(
      "fixtures/libraries/small/materials/AL-falcon-104/metadata.json",
    ) as Record<string, unknown>;
    const parsed = materialMetadataV1Schema.parse({ ...fixture, version: SCHEMA_VERSION });
    expect(parsed.id).toBe("AL-falcon-104");
  });

  it("rejects invalid material ids", () => {
    const result = materialMetadataV1Schema.safeParse({
      version: SCHEMA_VERSION,
      id: "bad id with spaces",
      fields: {},
      identifiers: {},
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
    expect(FIELD_SCHEMA_JSON).toBe(".certtrace/field-schema.json");
    expect(MATERIALS_DIR).toBe("materials");
  });
});
