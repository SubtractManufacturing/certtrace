import type { OpenLibraryResult } from "@certtrace/library-engine";
import {
  defaultFieldSchemaV1,
  type MaterialTableColumnV1,
  materialTableColumnIdentity,
} from "@certtrace/types";
import { Button } from "@certtrace/ui";
import { useEffect, useMemo, useState } from "react";
import { updateLibraryFieldSchema } from "../lib/library-client";
import { materialColumnOptions } from "../lib/material-columns";
import { ErrorBanner } from "./ErrorBanner";

interface MaterialTableColumnsEditorProps {
  library: OpenLibraryResult;
  onLibraryUpdated: (library: OpenLibraryResult) => void;
  onRefreshLibrary: () => Promise<void>;
}

export function MaterialTableColumnsEditor({
  library,
  onLibraryUpdated,
  onRefreshLibrary,
}: MaterialTableColumnsEditorProps) {
  const savedColumns = useMemo(
    () => library.fieldSchema.tableColumns ?? defaultFieldSchemaV1.tableColumns ?? [],
    [library.fieldSchema.tableColumns],
  );
  const [draftColumns, setDraftColumns] = useState<MaterialTableColumnV1[]>(savedColumns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftColumns(savedColumns);
  }, [savedColumns]);

  const savedColumnIds = savedColumns.map((column) => materialTableColumnIdentity(column));
  const draftColumnIds = draftColumns.map((column) => materialTableColumnIdentity(column));
  const dirty =
    savedColumnIds.length !== draftColumnIds.length ||
    savedColumnIds.some((identity, index) => identity !== draftColumnIds[index]);

  async function saveColumns() {
    setSaving(true);
    setError(null);
    try {
      const nextSchema = { ...library.fieldSchema, tableColumns: draftColumns };
      const updated = await updateLibraryFieldSchema(library, nextSchema);
      onLibraryUpdated(updated);
      await onRefreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Choose which columns appear in the materials table for this library.
      </p>

      <div className="space-y-1 rounded-md border border-slate-200 p-2 dark:border-slate-700">
        {materialColumnOptions(library.fieldSchema).map((option) => {
          const identity = materialTableColumnIdentity(option.column);
          const checked = draftColumns.some(
            (column) => materialTableColumnIdentity(column) === identity,
          );
          return (
            <label
              key={identity}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                aria-label={`${option.label.replace(" (compact)", "")} column`}
                checked={checked}
                onChange={(event) =>
                  setDraftColumns((current) =>
                    event.target.checked
                      ? [...current, option.column]
                      : current.filter(
                          (column) => materialTableColumnIdentity(column) !== identity,
                        ),
                  )
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <Button
        type="button"
        disabled={saving || draftColumns.length === 0 || !dirty}
        onClick={() => void saveColumns()}
      >
        Save columns
      </Button>
    </div>
  );
}
