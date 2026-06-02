import {
  NAMING_RULES_JSON,
  WORD_LISTS_JSON,
  createDefaultLibraryConfigV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
  libraryConfigV1Schema,
  namingRulesV1Schema,
  wordListsV1Schema,
  type LibraryConfigV1,
  type NamingRulesV1,
  type NamingStrategyV1,
  type WordListsV1,
} from "@certtrace/types";
import { LibraryError } from "./errors.js";
import { backupConfigFile } from "./config-backup.js";
import type { OpenLibraryResult } from "./types.js";

async function writeJson(
  fs: OpenLibraryResult["fs"],
  path: string,
  value: unknown,
): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export interface CreateLibraryOptions {
  name: string;
  idStrategy?: string;
  labelTemplate?: string;
  searchAllFields?: boolean;
  namingRules?: NamingRulesV1;
  wordLists?: WordListsV1;
}

export async function updateLibraryConfig(
  library: OpenLibraryResult,
  partial: Partial<Omit<LibraryConfigV1, "version">>,
): Promise<LibraryConfigV1> {
  const updated = libraryConfigV1Schema.parse({
    ...library.config,
    ...partial,
  });

  await writeJson(library.fs, library.paths.libraryJson, updated);
  library.config = updated;
  return updated;
}

export async function updateNamingRules(
  library: OpenLibraryResult,
  rules: NamingRulesV1,
): Promise<NamingRulesV1> {
  const validated = namingRulesV1Schema.parse(rules);
  await backupConfigFile(library.fs, library.paths.root, NAMING_RULES_JSON);
  await writeJson(library.fs, library.paths.namingRulesJson, validated);
  library.namingRules = validated;
  return validated;
}

export async function updateWordLists(
  library: OpenLibraryResult,
  lists: WordListsV1,
): Promise<WordListsV1> {
  const validated = wordListsV1Schema.parse(lists);
  await backupConfigFile(library.fs, library.paths.root, WORD_LISTS_JSON);
  await writeJson(library.fs, library.paths.wordListsJson, validated);
  library.wordLists = validated;
  return validated;
}

export function validateStrategyEntropy(
  strategy: NamingStrategyV1,
  wordLists: WordListsV1,
): string | null {
  if (strategy.template.includes("{number}")) {
    return null;
  }

  const wordTokens = [...strategy.template.matchAll(/\{word:([^}]+)\}/g)].map(
    (match) => match[1]!,
  );
  if (wordTokens.length === 0) {
    return "Template should include a sequential number or word categories for uniqueness.";
  }

  const totalWords = wordTokens.reduce((sum, listId) => {
    const list = wordLists.lists[listId];
    return sum + (list?.words.length ?? 0);
  }, 0);

  if (totalWords < 20) {
    return "Word lists are small — consider adding more words or a sequential number.";
  }

  return null;
}

export function addNamingStrategy(
  rules: NamingRulesV1,
  strategy: NamingStrategyV1,
): NamingRulesV1 {
  if (rules.strategies.some((entry) => entry.id === strategy.id)) {
    throw new LibraryError(`Strategy id already exists: ${strategy.id}`);
  }

  return namingRulesV1Schema.parse({
    ...rules,
    strategies: [...rules.strategies, strategy],
  });
}

export function duplicateNamingStrategy(
  rules: NamingRulesV1,
  strategyId: string,
  newId: string,
  newLabel: string,
): NamingRulesV1 {
  const source = rules.strategies.find((entry) => entry.id === strategyId);
  if (!source) {
    throw new LibraryError(`Strategy not found: ${strategyId}`);
  }

  return addNamingStrategy(rules, {
    ...source,
    id: newId,
    label: newLabel,
  });
}

export function renameNamingStrategy(
  rules: NamingRulesV1,
  strategyId: string,
  newLabel: string,
): NamingRulesV1 {
  return namingRulesV1Schema.parse({
    ...rules,
    strategies: rules.strategies.map((entry) =>
      entry.id === strategyId ? { ...entry, label: newLabel } : entry,
    ),
  });
}

export function deleteNamingStrategy(rules: NamingRulesV1, strategyId: string): NamingRulesV1 {
  if (rules.strategies.length <= 1) {
    throw new LibraryError("Cannot delete the last naming strategy.");
  }

  const next = rules.strategies.filter((entry) => entry.id !== strategyId);
  if (next.length === rules.strategies.length) {
    throw new LibraryError(`Strategy not found: ${strategyId}`);
  }

  const activeStrategyId =
    rules.activeStrategyId === strategyId ? next[0]!.id : rules.activeStrategyId;

  return namingRulesV1Schema.parse({
    ...rules,
    strategies: next,
    activeStrategyId,
  });
}

export function buildCreateLibraryConfig(options: CreateLibraryOptions): {
  config: LibraryConfigV1;
  namingRules: NamingRulesV1;
  wordLists: WordListsV1;
} {
  const namingRules = options.namingRules ?? defaultNamingRulesV1;
  const wordLists = options.wordLists ?? defaultWordListsV1;
  const idStrategy = options.idStrategy ?? namingRules.activeStrategyId;

  if (!namingRules.strategies.some((entry) => entry.id === idStrategy)) {
    throw new LibraryError(`Unknown id strategy: ${idStrategy}`);
  }

  const config = libraryConfigV1Schema.parse({
    ...createDefaultLibraryConfigV1(options.name.trim()),
    idStrategy,
    labelTemplate: options.labelTemplate ?? "standard-qr",
    searchAllFields: options.searchAllFields ?? true,
  });

  return { config, namingRules, wordLists };
}

export { defaultNamingRulesV1, defaultWordListsV1 };
