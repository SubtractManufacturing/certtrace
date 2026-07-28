import type { OpenLibraryResult } from "@certtrace/library-engine";
import {
  addNamingStrategy,
  deleteNamingStrategy,
  duplicateNamingStrategy,
  type RemoveSchemaDefinitionInput,
  validateStrategyEntropy,
} from "@certtrace/library-engine";
import type { FieldSchemaV1, NamingRulesV1, WordListsV1 } from "@certtrace/types";
import { Button, Label, Select } from "@certtrace/ui";
import { useState } from "react";
import {
  removeLibrarySchemaDefinition,
  updateLibraryConfigPartial,
  updateLibraryFieldSchema,
  updateLibraryNamingRules,
  updateLibraryWordLists,
} from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import { IdTemplateBuilder } from "./IdTemplateBuilder";
import { SchemaSettingsEditor } from "./SchemaSettingsEditor";
import { WordListEditor } from "./WordListEditor";

interface AdvancedLibrarySettingsViewProps {
  library: OpenLibraryResult;
  onLibraryUpdated: (library: OpenLibraryResult) => void;
}

export function AdvancedLibrarySettingsView({
  library,
  onLibraryUpdated,
}: AdvancedLibrarySettingsViewProps) {
  const [namingRules, setNamingRules] = useState<NamingRulesV1>(library.namingRules);
  const [wordLists, setWordLists] = useState<WordListsV1>(library.wordLists);
  const [fieldSchema, setFieldSchema] = useState<FieldSchemaV1>(library.fieldSchema);
  const [selectedStrategyId, setSelectedStrategyId] = useState(library.config.idStrategy);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedStrategy =
    namingRules.strategies.find((entry) => entry.id === selectedStrategyId) ??
    namingRules.strategies[0];

  async function saveConfig() {
    setBusy(true);
    setError(null);
    try {
      let updated = await updateLibraryNamingRules(library, {
        ...namingRules,
        activeStrategyId: selectedStrategyId,
      });
      updated = await updateLibraryWordLists(updated, wordLists);
      updated = await updateLibraryConfigPartial(updated, {
        idStrategy: selectedStrategyId,
      });
      updated = await updateLibraryFieldSchema(updated, fieldSchema);
      onLibraryUpdated(updated);
      setNamingRules(updated.namingRules);
      setWordLists(updated.wordLists);
      setFieldSchema(updated.fieldSchema);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeDefinition(input: RemoveSchemaDefinitionInput) {
    setBusy(true);
    setError(null);
    try {
      let updated = await updateLibraryFieldSchema(library, fieldSchema);
      updated = await removeLibrarySchemaDefinition(updated, input);
      onLibraryUpdated(updated);
      setFieldSchema(updated.fieldSchema);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function updateSelectedStrategy(next: typeof selectedStrategy) {
    setNamingRules({
      ...namingRules,
      strategies: namingRules.strategies.map((entry) => (entry.id === next.id ? next : entry)),
    });
  }

  const entropyWarning = selectedStrategy
    ? validateStrategyEntropy(selectedStrategy, wordLists)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6">
        <header>
          <h1 className="text-2xl font-semibold">Advanced settings</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{library.config.name}</p>
        </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Material schema</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configure receiving fields and lookup identifiers. Stable keys remain unchanged when
          labels are renamed.
        </p>
        <div className="mt-4">
          <SchemaSettingsEditor
            schema={fieldSchema}
            onChange={setFieldSchema}
            onRemoveDefinition={removeDefinition}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">ID strategies</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const created = addNamingStrategy(namingRules, {
                  id: `strategy-${Date.now()}`,
                  label: "New strategy",
                  template: "{number}",
                  numberPad: 0,
                });
                setNamingRules(created);
                setSelectedStrategyId(created.strategies.at(-1)?.id ?? created.activeStrategyId);
              }}
            >
              Add strategy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedStrategy}
              onClick={() => {
                const duplicated = duplicateNamingStrategy(
                  namingRules,
                  selectedStrategy.id,
                  `${selectedStrategy.id}-copy`,
                  `${selectedStrategy.label} copy`,
                );
                setNamingRules(duplicated);
                setSelectedStrategyId(`${selectedStrategy.id}-copy`);
              }}
            >
              Duplicate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedStrategy || namingRules.strategies.length <= 1}
              onClick={() => {
                const next = deleteNamingStrategy(namingRules, selectedStrategy.id);
                setNamingRules(next);
                setSelectedStrategyId(next.activeStrategyId);
              }}
            >
              Delete
            </Button>
          </div>
        </div>

        <label className="mt-4 block space-y-1 text-sm">
          <Label>Active strategy</Label>
          <Select
            value={selectedStrategyId}
            onChange={(event) => setSelectedStrategyId(event.target.value)}
          >
            {namingRules.strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.label}
              </option>
            ))}
          </Select>
        </label>

        {selectedStrategy ? (
          <div className="mt-4">
            <IdTemplateBuilder
              strategy={selectedStrategy}
              wordLists={wordLists}
              onChange={updateSelectedStrategy}
            />
          </div>
        ) : null}

        {entropyWarning ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{entropyWarning}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Word lists</h2>
        <div className="mt-4">
          <WordListEditor wordLists={wordLists} onChange={setWordLists} />
        </div>
      </section>

      {error ? <ErrorBanner message={error} /> : null}

      <div>
        <Button type="button" disabled={busy} onClick={() => void saveConfig()}>
          Save library settings
        </Button>
      </div>
      </div>
    </div>
  );
}
