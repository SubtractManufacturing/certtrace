import type { NamingCase, NamingStrategyV1, WordListsV1 } from "@certtrace/types";
import { MATERIAL_ID_PATTERN } from "@certtrace/types";

export class IdGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdGeneratorError";
  }
}

export interface GenerateMaterialIdInput {
  strategy: NamingStrategyV1;
  wordLists: WordListsV1;
  existingIds: ReadonlySet<string>;
  /** Value for `{material}` token (e.g. alloy prefix `AL`). */
  materialCode?: string;
  now?: Date;
  /** Injectable RNG for tests — returns [0, 1). */
  random?: () => number;
  maxAttempts?: number;
}

const LEGACY_WORD_TOKENS: Record<string, string> = {
  animal: "animals",
  adjective: "adjectives",
  color: "colors",
  city: "cities",
};

const TOKEN_PATTERN = /\{([^}]+)\}/g;

function padNumber(value: number, pad: number): string {
  return pad > 0 ? String(value).padStart(pad, "0") : String(value);
}

function applyCase(value: string, casing: NamingCase | undefined): string {
  switch (casing) {
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    default:
      return value;
  }
}

function pickWord(listId: string, wordLists: WordListsV1, random: () => number): string {
  const entry = wordLists.lists[listId];
  if (!entry || entry.words.length === 0) {
    throw new IdGeneratorError(`Word list "${listId}" is missing or empty`);
  }
  const index = Math.floor(random() * entry.words.length);
  return entry.words[index] ?? entry.words[0]!;
}

function resolveToken(token: string, input: GenerateMaterialIdInput, numberValue: number): string {
  if (token === "number") {
    const pad = input.strategy.numberPad ?? 0;
    return padNumber(numberValue, pad);
  }

  if (token === "material") {
    if (!input.materialCode) {
      throw new IdGeneratorError("materialCode is required for templates with {material}");
    }
    return input.materialCode;
  }

  const now = input.now ?? new Date();
  if (token === "year") {
    return String(now.getFullYear());
  }
  if (token === "month") {
    return String(now.getMonth() + 1).padStart(2, "0");
  }
  if (token === "day") {
    return String(now.getDate()).padStart(2, "0");
  }

  if (token.startsWith("word:")) {
    const listId = token.slice("word:".length);
    return pickWord(listId, input.wordLists, input.random ?? Math.random);
  }

  const legacyListId = LEGACY_WORD_TOKENS[token];
  if (legacyListId) {
    return pickWord(legacyListId, input.wordLists, input.random ?? Math.random);
  }

  throw new IdGeneratorError(`Unknown template token: {${token}}`);
}

function renderTemplate(
  template: string,
  input: GenerateMaterialIdInput,
  numberValue: number,
): string {
  return template.replace(TOKEN_PATTERN, (_match, token: string) =>
    resolveToken(token, input, numberValue),
  );
}

function nextNumberStart(strategy: NamingStrategyV1, existingIds: ReadonlySet<string>): number {
  const start = strategy.numberStart ?? 1;
  let max = start - 1;

  for (const id of existingIds) {
    const trailing = id.match(/(\d+)$/);
    if (trailing) {
      max = Math.max(max, Number.parseInt(trailing[1]!, 10));
    }
  }

  return Math.max(start, max + 1);
}

function assertFilesystemSafe(id: string): void {
  if (!MATERIAL_ID_PATTERN.test(id)) {
    throw new IdGeneratorError(`Generated id is not filesystem-safe: ${id}`);
  }
}

export function generateMaterialId(input: GenerateMaterialIdInput): string {
  const maxAttempts = input.maxAttempts ?? 100;
  let numberValue = nextNumberStart(input.strategy, input.existingIds);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = applyCase(
      renderTemplate(input.strategy.template, input, numberValue),
      input.strategy.case,
    );

    assertFilesystemSafe(candidate);

    if (!input.existingIds.has(candidate)) {
      return candidate;
    }

    if (input.strategy.template.includes("{number}")) {
      numberValue += 1;
    }
  }

  throw new IdGeneratorError(
    `Could not generate a unique id after ${maxAttempts} attempts for strategy "${input.strategy.id}"`,
  );
}

/** Non-colliding preview sample (does not consult existingIds beyond optional set). */
export function previewMaterialId(
  input: Omit<GenerateMaterialIdInput, "existingIds"> & { existingIds?: ReadonlySet<string> },
): string {
  return generateMaterialId({
    ...input,
    existingIds: input.existingIds ?? new Set(),
    random: input.random ?? (() => 0),
  });
}

export {
  parseTemplateToSegments,
  segmentsToTemplate,
  strategyFromSegments,
  type TemplateSegment,
} from "./template-segments.js";
