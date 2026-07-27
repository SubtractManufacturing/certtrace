import {
  createDefaultLibraryConfigV1,
  defaultFieldSchemaV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
  FIELD_SCHEMA_JSON,
  type FieldOptionV1,
  type FieldSchemaV1,
  type FieldValueV1,
  fieldSchemaV1Schema,
  type LibraryConfigV1,
  libraryConfigV1Schema,
  NAMING_RULES_JSON,
  type NamingRulesV1,
  type NamingStrategyV1,
  namingRulesV1Schema,
  WORD_LISTS_JSON,
  type WordListsV1,
  wordListsV1Schema,
} from "@certtrace/types";
import { backupConfigFile } from "./config-backup.js";
import { LibraryError } from "./errors.js";
import type { OpenLibraryResult } from "./types.js";

async function writeJson(fs: OpenLibraryResult["fs"], path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export interface CreateLibraryOptions {
  name: string;
  idStrategy?: string;
  labelTemplate?: string;
  namingRules?: NamingRulesV1;
  wordLists?: WordListsV1;
  fieldSchema?: FieldSchemaV1;
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

export async function updateFieldSchema(
  library: OpenLibraryResult,
  schema: FieldSchemaV1,
): Promise<FieldSchemaV1> {
  const validated = fieldSchemaV1Schema.parse(schema);
  await backupConfigFile(library.fs, library.paths.root, FIELD_SCHEMA_JSON);
  await writeJson(library.fs, library.paths.fieldSchemaJson, validated);
  library.fieldSchema = validated;
  return validated;
}

export interface AddFieldOptionInput {
  fieldKey: string;
  label: string;
  currentValues: Record<string, FieldValueV1>;
}

export interface AddFieldOptionResult {
  option: FieldOptionV1;
  fieldSchema: FieldSchemaV1;
}

export async function addFieldOption(
  library: OpenLibraryResult,
  input: AddFieldOptionInput,
): Promise<AddFieldOptionResult> {
  const trimmedLabel = input.label.trim();
  if (!trimmedLabel) {
    throw new LibraryError("Option name cannot be empty.");
  }

  const field = library.fieldSchema.fields.find((candidate) => candidate.key === input.fieldKey);
  if (!field || (field.type !== "single_select" && field.type !== "multi_select")) {
    throw new LibraryError(`Select field "${input.fieldKey}" was not found.`);
  }

  const duplicate = field.options?.find(
    (option) => option.label.toLocaleLowerCase() === trimmedLabel.toLocaleLowerCase(),
  );
  if (duplicate) {
    throw new LibraryError(`${field.label} already has an option named "${duplicate.label}".`);
  }

  const baseId =
    trimmedLabel
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "option";
  const existingIds = new Set(field.options?.map((option) => option.id));
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}_${suffix}`;
    suffix += 1;
  }

  const option: FieldOptionV1 = { id, label: trimmedLabel };
  const nextSchema: FieldSchemaV1 = {
    ...library.fieldSchema,
    fields: library.fieldSchema.fields.map((candidate) => {
      if (candidate.key !== input.fieldKey) {
        return candidate;
      }

      let dependsOn = candidate.dependsOn;
      if (dependsOn?.filterOptionsBy) {
        const parentValue = input.currentValues[dependsOn.fieldKey];
        const parentIds =
          typeof parentValue === "string"
            ? [parentValue]
            : Array.isArray(parentValue)
              ? parentValue
              : [];
        if (parentIds.length === 0) {
          throw new LibraryError(
            `Select ${schemaFieldLabel(library.fieldSchema, dependsOn.fieldKey)} before adding a ${candidate.label} option.`,
          );
        }

        const filterOptionsBy = { ...dependsOn.filterOptionsBy };
        for (const parentId of parentIds) {
          filterOptionsBy[parentId] = [...(filterOptionsBy[parentId] ?? []), option.id];
        }
        dependsOn = { ...dependsOn, filterOptionsBy };
      }

      return {
        ...candidate,
        options: [...(candidate.options ?? []), option],
        dependsOn,
      };
    }),
  };

  const fieldSchema = await updateFieldSchema(library, nextSchema);
  return { option, fieldSchema };
}

function schemaFieldLabel(schema: FieldSchemaV1, fieldKey: string): string {
  return schema.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
}

export function validateStrategyEntropy(
  strategy: NamingStrategyV1,
  wordLists: WordListsV1,
): string | null {
  if (strategy.template.includes("{number}")) {
    return null;
  }

  const wordTokens = [...strategy.template.matchAll(/\{word:([^}]+)\}/g)].map((match) => match[1]!);
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

export function addNamingStrategy(rules: NamingRulesV1, strategy: NamingStrategyV1): NamingRulesV1 {
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
  fieldSchema: FieldSchemaV1;
} {
  const namingRules = options.namingRules ?? defaultNamingRulesV1;
  const wordLists = options.wordLists ?? defaultWordListsV1;
  const fieldSchema = fieldSchemaV1Schema.parse(options.fieldSchema ?? defaultFieldSchemaV1);
  const idStrategy = options.idStrategy ?? namingRules.activeStrategyId;

  if (!namingRules.strategies.some((entry) => entry.id === idStrategy)) {
    throw new LibraryError(`Unknown id strategy: ${idStrategy}`);
  }

  const config = libraryConfigV1Schema.parse({
    ...createDefaultLibraryConfigV1(options.name.trim()),
    idStrategy,
    labelTemplate: options.labelTemplate ?? "standard-qr",
  });

  return { config, namingRules, wordLists, fieldSchema };
}

export { defaultFieldSchemaV1, defaultNamingRulesV1, defaultWordListsV1 };
