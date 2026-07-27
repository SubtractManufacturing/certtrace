import {
  type CreateMaterialInput,
  filterMaterialsBySchema,
  type MaterialFilterValues,
  type OpenLibraryResult,
} from "@certtrace/library-engine";
import {
  defaultFieldSchemaV1,
  type MaterialTableColumnV1,
  materialTableColumnIdentity,
} from "@certtrace/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SearchInput,
} from "@certtrace/ui";
import { Columns3, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActiveLibraryPath } from "../hooks/useLibrarySession";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import {
  addLibraryFieldOption,
  addMaterial,
  fetchMaterialAttachments,
  openLibraryAtPath,
  updateLibraryFieldSchema,
} from "../lib/library-client";
import { materialColumnOptions } from "../lib/material-columns";
import { ErrorBanner } from "./ErrorBanner";
import { MaterialDetailPanel } from "./MaterialDetailPanel";
import { emptyMaterialFilters, MaterialFiltersBar } from "./MaterialFiltersBar";
import {
  type MaterialFormValues,
  MaterialSchemaForm,
  validateMaterialValues,
} from "./MaterialSchemaForm";
import { MaterialTable } from "./MaterialTable";

interface MaterialsWorkspaceProps {
  sessionLibraries: Map<string, OpenLibraryResult>;
  activeLibraryPath: ActiveLibraryPath;
  materials: IndexedMaterial[];
  loading?: boolean;
  error?: string | null;
  onRefreshLibrary: (path: string) => Promise<void>;
  filterMaterials: (query: string) => IndexedMaterial[];
  onEnsureLibrary?: (path: string) => Promise<OpenLibraryResult | undefined>;
}

const emptyFormValues: MaterialFormValues = { fields: {}, identifiers: {} };

export function MaterialsWorkspace({
  sessionLibraries,
  activeLibraryPath,
  materials,
  loading = false,
  error = null,
  onRefreshLibrary,
  filterMaterials,
  onEnsureLibrary,
}: MaterialsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<IndexedMaterial | null>(null);
  const [panelLibrary, setPanelLibrary] = useState<OpenLibraryResult | null>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Map<string, number>>(new Map());
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<MaterialFormValues>(emptyFormValues);
  const [schemaFilters, setSchemaFilters] = useState<MaterialFilterValues>(emptyMaterialFilters);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [tableColumns, setTableColumns] = useState<MaterialTableColumnV1[] | undefined>();
  const [draftColumns, setDraftColumns] = useState<MaterialTableColumnV1[]>([]);
  const [columnsSaving, setColumnsSaving] = useState(false);
  const searchInputId = "materials-search-input";

  const showLibraryColumn = activeLibraryPath === "all";
  const wideLayout = typeof window !== "undefined" ? window.innerWidth >= 1100 : false;

  const activeSingleLibrary =
    activeLibraryPath && activeLibraryPath !== "all"
      ? (sessionLibraries.get(activeLibraryPath) ?? null)
      : null;

  const searchedMaterials = useMemo(() => filterMaterials(query), [filterMaterials, query]);
  const filteredMaterials = useMemo(
    () =>
      activeSingleLibrary
        ? filterMaterialsBySchema(searchedMaterials, activeSingleLibrary.fieldSchema, schemaFilters)
        : searchedMaterials,
    [activeSingleLibrary, schemaFilters, searchedMaterials],
  );

  const listSchema = activeSingleLibrary?.fieldSchema ?? defaultFieldSchemaV1;
  const visibleListSchema = useMemo(
    () => (tableColumns ? { ...listSchema, tableColumns } : listSchema),
    [listSchema, tableColumns],
  );

  const searchPlaceholder =
    activeLibraryPath === "all"
      ? "Search all libraries…"
      : `Search ${sessionLibraries.get(activeLibraryPath ?? "")?.config.name ?? "library"}…`;

  const activeLibrary = panelLibrary;

  useEffect(() => {
    if (!selectedMaterial) {
      setPanelLibrary(null);
      return;
    }

    const inSession = sessionLibraries.get(selectedMaterial.libraryPath);
    if (inSession) {
      setPanelLibrary(inSession);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const library = onEnsureLibrary
          ? await onEnsureLibrary(selectedMaterial.libraryPath)
          : await openLibraryAtPath(selectedMaterial.libraryPath);
        if (!cancelled && library) {
          setPanelLibrary(library);
        }
      } catch (err) {
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : String(err));
          setSelectedMaterial(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onEnsureLibrary, selectedMaterial, sessionLibraries]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: changing library scope must clear its filters
  useEffect(() => {
    setSchemaFilters(emptyMaterialFilters);
  }, [activeLibraryPath]);

  useEffect(() => {
    setTableColumns(activeSingleLibrary?.fieldSchema.tableColumns);
  }, [activeSingleLibrary]);

  const loadAttachmentCounts = useCallback(async () => {
    const counts = new Map<string, number>();
    await Promise.all(
      materials.map(async (entry) => {
        const library = sessionLibraries.get(entry.libraryPath);
        if (!library) {
          return;
        }
        const attachments = await fetchMaterialAttachments(library, entry.id);
        counts.set(`${entry.libraryPath}:${entry.id}`, attachments.length);
      }),
    );
    setAttachmentCounts(counts);
  }, [materials, sessionLibraries]);

  useEffect(() => {
    void loadAttachmentCounts();
  }, [loadAttachmentCounts]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (
        (event.key === "/" && !isTyping) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        document.getElementById(searchInputId)?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function resetAddForm() {
    setFormValues(emptyFormValues);
  }

  async function handleAddMaterial() {
    if (!activeLibraryPath || activeLibraryPath === "all") {
      setLocalError("Select a single library before adding materials.");
      return;
    }
    const library = sessionLibraries.get(activeLibraryPath);
    if (!library) {
      return;
    }

    const validationErrors = validateMaterialValues(
      library.fieldSchema,
      formValues.fields,
      formValues.identifiers,
    );
    if (validationErrors.length > 0) {
      setLocalError(validationErrors.join(". "));
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      const input: CreateMaterialInput = {
        fields: formValues.fields,
        identifiers: formValues.identifiers,
      };
      await addMaterial(library, input);
      await onRefreshLibrary(activeLibraryPath);
      setAddOpen(false);
      resetAddForm();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTableColumns() {
    if (!activeSingleLibrary) {
      return;
    }

    setColumnsSaving(true);
    setLocalError(null);
    try {
      const nextSchema = { ...activeSingleLibrary.fieldSchema, tableColumns: draftColumns };
      setTableColumns(draftColumns);
      await updateLibraryFieldSchema(activeSingleLibrary, nextSchema);
      await onRefreshLibrary(activeSingleLibrary.paths.root);
      setColumnPickerOpen(false);
    } catch (err) {
      setTableColumns(activeSingleLibrary.fieldSchema.tableColumns);
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setColumnsSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <SearchInput
              id={searchInputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-[16rem]"
            />
            {activeSingleLibrary ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                aria-label="Choose columns"
                onClick={() => {
                  setDraftColumns(
                    tableColumns ??
                      activeSingleLibrary.fieldSchema.tableColumns ??
                      defaultFieldSchemaV1.tableColumns ??
                      [],
                  );
                  setColumnPickerOpen(true);
                }}
              >
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            ) : null}
            <Button
              type="button"
              className="shrink-0"
              disabled={activeLibraryPath === "all" || !activeLibraryPath}
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add material
            </Button>
          </div>
          {activeSingleLibrary ? (
            <MaterialFiltersBar
              schema={activeSingleLibrary.fieldSchema}
              values={schemaFilters}
              onChange={setSchemaFilters}
            />
          ) : null}
        </header>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading materials…</p>
          ) : filteredMaterials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {materials.length === 0
                  ? "No materials yet. Add your first material or open another library."
                  : "No materials match your search or filters."}
              </p>
            </div>
          ) : (
            <MaterialTable
              materials={filteredMaterials}
              schema={visibleListSchema}
              resolveSchema={(libraryPath) =>
                sessionLibraries.get(libraryPath)?.fieldSchema ?? defaultFieldSchemaV1
              }
              showLibraryColumn={showLibraryColumn}
              attachmentCounts={attachmentCounts}
              selectedMaterialId={selectedMaterial?.id ?? null}
              onSelectMaterial={setSelectedMaterial}
            />
          )}

          {error || localError ? (
            <div className="mt-4">
              <ErrorBanner message={error ?? localError ?? ""} />
            </div>
          ) : null}
        </div>
      </div>

      {selectedMaterial && activeLibrary ? (
        <MaterialDetailPanel
          library={activeLibrary}
          material={selectedMaterial}
          open={Boolean(selectedMaterial)}
          wideLayout={wideLayout}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMaterial(null);
            }
          }}
          onMaterialUpdated={async () => {
            await onRefreshLibrary(selectedMaterial.libraryPath);
          }}
        />
      ) : null}

      <Dialog open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose material columns</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {activeSingleLibrary
              ? materialColumnOptions(activeSingleLibrary.fieldSchema).map((option) => {
                  const identity = materialTableColumnIdentity(option.column);
                  const checked = draftColumns.some(
                    (column) => materialTableColumnIdentity(column) === identity,
                  );
                  return (
                    <label
                      key={identity}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
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
                })
              : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setColumnPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={columnsSaving || draftColumns.length === 0}
              onClick={() => void saveTableColumns()}
            >
              Save columns
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            resetAddForm();
            setLocalError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add material</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {activeSingleLibrary ? (
              <MaterialSchemaForm
                schema={activeSingleLibrary.fieldSchema}
                values={formValues}
                onChange={setFormValues}
                onAddOption={(input) => addLibraryFieldOption(activeSingleLibrary, input)}
                idPrefix="add-material"
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleAddMaterial()}>
              Add material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
