import { defaultNamingRulesV1, defaultWordListsV1, SCHEMA_VERSION } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { generateMaterialId, IdGeneratorError, previewMaterialId } from "../src/index.js";

const tinyWordLists = {
  version: SCHEMA_VERSION,
  lists: {
    adjectives: { label: "Adjectives", words: ["cute", "brave"] },
    colors: { label: "Colors", words: ["purple", "gold"] },
    animals: { label: "Animals", words: ["panda", "falcon"] },
  },
};

const numericStrategy = {
  id: "numeric",
  label: "Numeric only",
  template: "{number}",
  numberStart: 10001,
  numberPad: 0,
};

const materialAnimalNumberStrategy = {
  id: "material-animal-number",
  label: "Material + animal + number",
  template: "{material}-{word:animals}-{number}",
  numberPad: 3,
  case: "lower" as const,
};

describe("generateMaterialId", () => {
  it("generates numeric ids with numberStart", () => {
    const id = generateMaterialId({
      strategy: numericStrategy,
      wordLists: tinyWordLists,
      existingIds: new Set(),
    });
    expect(id).toBe("10001");
  });

  it("uses the selected Family option short code for the material token", () => {
    const id = generateMaterialId({
      strategy: materialAnimalNumberStrategy,
      wordLists: tinyWordLists,
      existingIds: new Set(),
      materialOption: { id: "aluminum", label: "Aluminum", shortCode: "AL" },
      random: () => 0,
    });
    expect(id).toBe("al-panda-001");
  });

  it("uses the selected Family option label when its short code is empty", () => {
    const id = generateMaterialId({
      strategy: materialAnimalNumberStrategy,
      wordLists: tinyWordLists,
      existingIds: new Set(),
      materialOption: { id: "stainless", label: "Stainless Steel" },
      random: () => 0,
    });
    expect(id).toBe("stainless-steel-panda-001");
  });

  it("increments number on collision", () => {
    const first = generateMaterialId({
      strategy: numericStrategy,
      wordLists: tinyWordLists,
      existingIds: new Set(),
    });
    const second = generateMaterialId({
      strategy: numericStrategy,
      wordLists: tinyWordLists,
      existingIds: new Set([first]),
    });
    expect(second).toBe("10002");
  });

  it("re-rolls word tokens until the id is unique", () => {
    let calls = 0;
    const id = generateMaterialId({
      strategy: defaultNamingRulesV1.strategies[0]!,
      wordLists: tinyWordLists,
      existingIds: new Set(["cute-purple-panda"]),
      random: () => {
        const value = calls < 3 ? 0 : 0.9;
        calls += 1;
        return value;
      },
    });
    expect(id).toBe("brave-gold-falcon");
  });

  it("supports legacy {animal} shorthand", () => {
    const id = generateMaterialId({
      strategy: {
        id: "legacy-animal",
        label: "Legacy animal",
        template: "{animal}-{number}",
        numberPad: 3,
        case: "lower",
      },
      wordLists: tinyWordLists,
      existingIds: new Set(),
      random: () => 0,
    });
    expect(id).toBe("panda-001");
  });

  it("throws when the selected Family option is missing", () => {
    expect(() =>
      generateMaterialId({
        strategy: {
          id: "prefix-numeric",
          label: "Prefix + numeric",
          template: "{material}-{number}",
          numberPad: 0,
        },
        wordLists: tinyWordLists,
        existingIds: new Set(),
      }),
    ).toThrow(IdGeneratorError);
  });
});

describe("previewMaterialId", () => {
  it("returns deterministic preview samples for the shipped default", () => {
    expect(
      previewMaterialId({
        strategy: defaultNamingRulesV1.strategies[0]!,
        wordLists: defaultWordListsV1,
      }),
    ).toBe("able-red-dog");
  });
});

describe("shipped default", () => {
  it("generates a unique adjective-color-animal id", () => {
    const id = generateMaterialId({
      strategy: defaultNamingRulesV1.strategies[0]!,
      wordLists: defaultWordListsV1,
      existingIds: new Set(),
      random: () => 0,
    });
    expect(id).toBe("able-red-dog");
  });
});
