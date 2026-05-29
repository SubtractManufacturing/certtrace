import { describe, expect, it } from "vitest";
import { defaultNamingRulesV1, defaultWordListsV1 } from "@certtrace/types";
import { generateMaterialId, IdGeneratorError, previewMaterialId } from "../src/index.js";

const strategy = (id: string) => {
  const found = defaultNamingRulesV1.strategies.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing strategy ${id}`);
  }
  return found;
};

describe("generateMaterialId", () => {
  it("generates numeric ids with numberStart", () => {
    const id = generateMaterialId({
      strategy: strategy("numeric"),
      wordLists: defaultWordListsV1,
      existingIds: new Set(),
    });
    expect(id).toBe("10001");
  });

  it("generates material-animal-number ids", () => {
    const id = generateMaterialId({
      strategy: strategy("material-animal-number"),
      wordLists: defaultWordListsV1,
      existingIds: new Set(),
      materialCode: "AL",
      random: () => 0,
    });
    expect(id).toBe("al-falcon-001");
  });

  it("increments number on collision", () => {
    const first = generateMaterialId({
      strategy: strategy("numeric"),
      wordLists: defaultWordListsV1,
      existingIds: new Set(),
    });
    const second = generateMaterialId({
      strategy: strategy("numeric"),
      wordLists: defaultWordListsV1,
      existingIds: new Set([first]),
    });
    expect(second).toBe("10002");
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
      wordLists: defaultWordListsV1,
      existingIds: new Set(),
      random: () => 0,
    });
    expect(id).toBe("falcon-001");
  });

  it("throws when materialCode is missing", () => {
    expect(() =>
      generateMaterialId({
        strategy: strategy("prefix-numeric"),
        wordLists: defaultWordListsV1,
        existingIds: new Set(),
      }),
    ).toThrow(IdGeneratorError);
  });
});

describe("previewMaterialId", () => {
  it("returns deterministic preview samples", () => {
    expect(
      previewMaterialId({
        strategy: strategy("word-pair"),
        wordLists: defaultWordListsV1,
      }),
    ).toBe("blue-falcon");
  });
});

describe("shipped presets", () => {
  const presetIds = [
    "numeric",
    "prefix-numeric",
    "date-based",
    "word-pair",
    "three-word",
    "animal-number",
    "material-animal-number",
  ] as const;

  it.each(presetIds)("generates unique id for preset %s", (presetId) => {
    const id = generateMaterialId({
      strategy: strategy(presetId),
      wordLists: defaultWordListsV1,
      existingIds: new Set(),
      materialCode: "AL",
      now: new Date("2026-05-28T12:00:00.000Z"),
      random: () => 0,
    });
    expect(id.length).toBeGreaterThan(0);
  });
});
