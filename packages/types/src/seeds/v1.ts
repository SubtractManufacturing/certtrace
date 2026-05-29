import type { LibraryConfigV1, NamingRulesV1, WordListsV1 } from "../schemas/v1.js";

export const defaultWordListsV1: WordListsV1 = {
  version: 1,
  lists: {
    animals: {
      label: "Animals",
      words: ["falcon", "river", "hammer", "oak"],
    },
    adjectives: {
      label: "Adjectives",
      words: ["blue", "swift", "prime"],
    },
    colors: {
      label: "Colors",
      words: ["red", "slate", "amber"],
    },
    cities: {
      label: "Cities",
      words: ["denver", "toledo", "austin"],
    },
  },
};

export const defaultNamingRulesV1: NamingRulesV1 = {
  version: 1,
  activeStrategyId: "material-animal-number",
  strategies: [
    {
      id: "numeric",
      label: "Numeric only",
      template: "{number}",
      numberStart: 10001,
      numberPad: 0,
    },
    {
      id: "prefix-numeric",
      label: "Prefix + numeric",
      template: "{material}-{number}",
      numberPad: 0,
    },
    {
      id: "date-based",
      label: "Date-based",
      template: "{material}-{year}{month}{day}-{number}",
      numberPad: 3,
    },
    {
      id: "word-pair",
      label: "Word pair",
      template: "{word:adjectives}-{word:animals}",
      case: "lower",
    },
    {
      id: "three-word",
      label: "Three word",
      template: "{word:adjectives}.{word:animals}.{word:cities}",
      case: "lower",
    },
    {
      id: "animal-number",
      label: "Animal + number",
      template: "{word:animals}-{number}",
      numberPad: 3,
      case: "lower",
    },
    {
      id: "material-animal-number",
      label: "Material + animal + number",
      template: "{material}-{word:animals}-{number}",
      numberPad: 3,
      case: "lower",
    },
  ],
};

export function createDefaultLibraryConfigV1(name: string): LibraryConfigV1 {
  return {
    version: 1,
    name,
    idStrategy: defaultNamingRulesV1.activeStrategyId,
    labelTemplate: "standard-qr",
    searchAllFields: true,
  };
}
