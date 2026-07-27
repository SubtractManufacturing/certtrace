import type { CreateMaterialInput, OpenLibraryResult } from "@certtrace/library-engine";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchInput,
  Textarea,
} from "@certtrace/ui";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActiveLibraryPath } from "../hooks/useLibrarySession";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import { addMaterial, fetchMaterialAttachments, openLibraryAtPath } from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import { MaterialDetailPanel } from "./MaterialDetailPanel";
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
  const [materialCode, setMaterialCode] = useState("AL");
  const [alloy, setAlloy] = useState("");
  const [supplier, setSupplier] = useState("");
  const [heatNumber, setHeatNumber] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");
  const searchInputId = "materials-search-input";

  const filteredMaterials = useMemo(() => filterMaterials(query), [filterMaterials, query]);
  const showLibraryColumn = activeLibraryPath === "all";
  const wideLayout = typeof window !== "undefined" ? window.innerWidth >= 1100 : false;

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

  async function handleAddMaterial() {
    if (!activeLibraryPath || activeLibraryPath === "all") {
      setLocalError("Select a single library before adding materials.");
      return;
    }
    const library = sessionLibraries.get(activeLibraryPath);
    if (!library) {
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      const input: CreateMaterialInput = {
        materialCode,
        fields: {
          ...(alloy ? { alloy } : {}),
          ...(supplier ? { supplier } : {}),
          ...(storageLocation ? { storage_location: storageLocation } : {}),
          ...(notes ? { notes } : {}),
        },
        identifiers: {
          ...(heatNumber ? { heat_number: heatNumber } : {}),
        },
      };
      await addMaterial(library, input);
      await onRefreshLibrary(activeLibraryPath);
      setAddOpen(false);
      setAlloy("");
      setSupplier("");
      setHeatNumber("");
      setStorageLocation("");
      setNotes("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
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
        </header>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading materials…</p>
          ) : filteredMaterials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {materials.length === 0
                  ? "No materials yet. Add your first material or open another library."
                  : "No materials match your search."}
              </p>
            </div>
          ) : (
            <MaterialTable
              materials={filteredMaterials}
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <Label>Material code</Label>
              <Input
                value={materialCode}
                onChange={(event) => setMaterialCode(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <Label>Alloy</Label>
              <Input value={alloy} onChange={(event) => setAlloy(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <Label>Supplier</Label>
              <Input value={supplier} onChange={(event) => setSupplier(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <Label>Heat Number</Label>
              <Input value={heatNumber} onChange={(event) => setHeatNumber(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <Label>Storage Location</Label>
              <Input
                value={storageLocation}
                onChange={(event) => setStorageLocation(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
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
