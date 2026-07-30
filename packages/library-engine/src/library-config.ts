import {
  type AttachmentKindV1,
  createDefaultLibraryConfigV1,
  defaultFieldSchemaV1,
  defaultNamingRulesV1,
  defaultWordListsV1,
  FIELD_SCHEMA_JSON,
  type FieldDefinitionV1,
  type FieldOptionV1,
  type FieldSchemaV1,
  type FieldType,
  type FieldValueV1,
  fieldDefinitionV1Schema,
  fieldSchemaV1Schema,
  type IdentifierKindV1,
  identifierKindV1Schema,
  type LabelTemplate,
  type LibraryConfigV1,
  labelTemplateSchema,
  libraryConfigV1Schema,
  materialTableColumnIdentity,
  NAMING_RULES_JSON,
  type NamingRulesV1,
  type NamingStrategyV1,
  namingRulesV1Schema,
  WORD_LISTS_JSON,
  type WordListsV1,
  wordListsV1Schema,
} from "@certtrace/types";
import { clearAttachmentKindAssignments } from "./attachments.js";
import { backupConfigFile } from "./config-backup.js";
import { LibraryError } from "./errors.js";
import type { OpenLibraryResult } from "./types.js";

async function writeJson(fs: OpenLibraryResult["fs"], path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createStableKey(label: string, fallback: string, existingKeys: Set<string>): string {
  const baseKey =
    label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback;
  let key = baseKey;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }
  return key;
}

function validateFieldDependencies(schema: FieldSchemaV1): void {
  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(fieldKey: string): void {
    if (visiting.has(fieldKey)) {
      throw new LibraryError("Field dependencies cannot contain a cycle.");
    }
    if (visited.has(fieldKey)) {
      return;
    }

    visiting.add(fieldKey);
    const parentKey = fieldsByKey.get(fieldKey)?.dependsOn?.fieldKey;
    if (parentKey) {
      if (!fieldsByKey.has(parentKey)) {
        throw new LibraryError(`Field "${fieldKey}" depends on unknown field "${parentKey}".`);
      }
      visit(parentKey);
    }
    visiting.delete(fieldKey);
    visited.add(fieldKey);
  }

  for (const field of schema.fields) {
    visit(field.key);
  }
}

export function createFieldDefinition(
  schema: FieldSchemaV1,
  labelInput: string,
  type: FieldType,
): FieldDefinitionV1 {
  const label = labelInput.trim();
  if (!label) {
    throw new LibraryError("Field name cannot be empty.");
  }
  const existingKeys = new Set([
    ...schema.fields.map((field) => field.key),
    "id",
    "createdAt",
    "updatedAt",
  ]);
  const key = createStableKey(label, "field", existingKeys);
  const options =
    type === "single_select" || type === "multi_select"
      ? [{ id: "option", label: "New option" }]
      : undefined;
  return fieldDefinitionV1Schema.parse({
    key,
    label,
    type,
    required: false,
    filterable: false,
    ...(options ? { options } : {}),
  });
}

export function createIdentifierKind(schema: FieldSchemaV1, labelInput: string): IdentifierKindV1 {
  const label = labelInput.trim();
  if (!label) {
    throw new LibraryError("Identifier kind name cannot be empty.");
  }
  return identifierKindV1Schema.parse({
    key: createStableKey(
      label,
      "identifier",
      new Set(schema.identifierKinds.map((kind) => kind.key)),
    ),
    label,
    required: false,
    filterable: false,
  });
}

export function createAttachmentKind(schema: FieldSchemaV1, labelInput: string): AttachmentKindV1 {
  const label = labelInput.trim();
  if (!label) {
    throw new LibraryError("Attachment kind name cannot be empty.");
  }
  return {
    key: createStableKey(
      label,
      "attachment",
      new Set(schema.attachmentKinds.map((kind) => kind.key)),
    ),
    label,
  };
}

export function createFieldOption(field: FieldDefinitionV1, labelInput: string): FieldOptionV1 {
  if (field.type !== "single_select" && field.type !== "multi_select") {
    throw new LibraryError(`Field "${field.label}" is not a select field.`);
  }
  const label = labelInput.trim();
  if (!label) {
    throw new LibraryError("Option name cannot be empty.");
  }
  const duplicate = field.options?.find(
    (option) => option.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  if (duplicate) {
    throw new LibraryError(`${field.label} already has an option named "${duplicate.label}".`);
  }
  return {
    id: createStableKey(label, "option", new Set(field.options?.map((option) => option.id))),
    label,
  };
}

export function changeFieldType(field: FieldDefinitionV1, type: FieldType): FieldDefinitionV1 {
  if (field.type === type) {
    return fieldDefinitionV1Schema.parse(field);
  }
  const { options: _options, dependsOn, ...base } = field;
  const nextDependsOn = dependsOn
    ? type === "single_select" || type === "multi_select"
      ? { fieldKey: dependsOn.fieldKey, filterOptionsBy: {} }
      : { fieldKey: dependsOn.fieldKey, visibleWhen: [] }
    : undefined;
  return fieldDefinitionV1Schema.parse({
    ...base,
    type,
    ...(type === "single_select" || type === "multi_select"
      ? { options: [{ id: "option", label: "New option" }] }
      : {}),
    ...(nextDependsOn ? { dependsOn: nextDependsOn } : {}),
  });
}

export function canReplaceFieldDefinition(
  source: FieldDefinitionV1,
  target: FieldDefinitionV1,
): boolean {
  if (source.type !== target.type) {
    return false;
  }
  if (source.type !== "single_select" && source.type !== "multi_select") {
    return true;
  }
  const targetOptionIds = new Set(target.options?.map((option) => option.id));
  return source.options?.every((option) => targetOptionIds.has(option.id)) ?? true;
}

export interface CreateLibraryOptions {
  name: string;
  idStrategy?: string;
  namingRules?: NamingRulesV1;
  wordLists?: WordListsV1;
  fieldSchema?: FieldSchemaV1;
}

export function addLabelTemplate(
  config: LibraryConfigV1,
  template: LabelTemplate,
): LibraryConfigV1 {
  const validated = labelTemplateSchema.parse(template);
  if (config.labelTemplates.some((entry) => entry.id === validated.id)) {
    throw new LibraryError(`Label Template id already exists: ${validated.id}`);
  }

  return libraryConfigV1Schema.parse({
    ...config,
    labelTemplates: [...config.labelTemplates, validated],
  });
}

export function updateLabelTemplate(
  config: LibraryConfigV1,
  template: LabelTemplate,
): LibraryConfigV1 {
  const validated = labelTemplateSchema.parse(template);
  if (!config.labelTemplates.some((entry) => entry.id === validated.id)) {
    throw new LibraryError(`Label Template not found: ${validated.id}`);
  }

  return libraryConfigV1Schema.parse({
    ...config,
    labelTemplates: config.labelTemplates.map((entry) =>
      entry.id === validated.id ? validated : entry,
    ),
  });
}

export function deleteLabelTemplate(config: LibraryConfigV1, templateId: string): LibraryConfigV1 {
  if (config.labelTemplates.length <= 1) {
    throw new LibraryError("Cannot delete the last Label Template.");
  }

  const next = config.labelTemplates.filter((entry) => entry.id !== templateId);
  if (next.length === config.labelTemplates.length) {
    throw new LibraryError(`Label Template not found: ${templateId}`);
  }

  const defaultLabelTemplateId =
    config.defaultLabelTemplateId === templateId ? next[0]!.id : config.defaultLabelTemplateId;

  return libraryConfigV1Schema.parse({
    ...config,
    labelTemplates: next,
    defaultLabelTemplateId,
  });
}

export function setDefaultLabelTemplate(
  config: LibraryConfigV1,
  templateId: string,
): LibraryConfigV1 {
  if (!config.labelTemplates.some((entry) => entry.id === templateId)) {
    throw new LibraryError(
      `Default Label Template must reference an existing template: ${templateId}`,
    );
  }

  return libraryConfigV1Schema.parse({
    ...config,
    defaultLabelTemplateId: templateId,
  });
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

function dropMissingTableColumns(schema: FieldSchemaV1): FieldSchemaV1 {
  if (!schema.tableColumns) {
    return schema;
  }

  const fieldKeys = new Set(schema.fields.map((field) => field.key));
  const identifierKeys = new Set(schema.identifierKinds.map((kind) => kind.key));
  const seen = new Set<string>();
  const tableColumns = schema.tableColumns.filter((column) => {
    const exists =
      column.kind === "field"
        ? fieldKeys.has(column.key)
        : column.kind === "identifier"
          ? identifierKeys.has(column.key)
          : column.kind !== "identifiers" || identifierKeys.size > 0;
    const identity = materialTableColumnIdentity(column);
    if (!exists || seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });

  return { ...schema, tableColumns };
}

export async function updateFieldSchema(
  library: OpenLibraryResult,
  schema: FieldSchemaV1,
): Promise<FieldSchemaV1> {
  const validated = fieldSchemaV1Schema.parse(dropMissingTableColumns(schema));
  validateFieldDependencies(validated);
  const nextKindKeys = new Set(validated.attachmentKinds.map((kind) => kind.key));
  const removedKindKeys = new Set(
    library.fieldSchema.attachmentKinds
      .map((kind) => kind.key)
      .filter((kindKey) => !nextKindKeys.has(kindKey)),
  );
  const restoreAssignments = await clearAttachmentKindAssignments(library, removedKindKeys);
  try {
    await backupConfigFile(library.fs, library.paths.root, FIELD_SCHEMA_JSON);
    await writeJson(library.fs, library.paths.fieldSchemaJson, validated);
  } catch (error) {
    await restoreAssignments().catch(() => undefined);
    throw error;
  }
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
  const field = library.fieldSchema.fields.find((candidate) => candidate.key === input.fieldKey);
  if (!field || (field.type !== "single_select" && field.type !== "multi_select")) {
    throw new LibraryError(`Select field "${input.fieldKey}" was not found.`);
  }

  const option = createFieldOption(field, input.label);
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
  validateFieldDependencies(fieldSchema);
  const idStrategy = options.idStrategy ?? namingRules.activeStrategyId;

  if (!namingRules.strategies.some((entry) => entry.id === idStrategy)) {
    throw new LibraryError(`Unknown id strategy: ${idStrategy}`);
  }

  const config = libraryConfigV1Schema.parse({
    ...createDefaultLibraryConfigV1(options.name.trim()),
    idStrategy,
  });

  return { config, namingRules, wordLists, fieldSchema };
}

export { defaultFieldSchemaV1, defaultNamingRulesV1, defaultWordListsV1 };
