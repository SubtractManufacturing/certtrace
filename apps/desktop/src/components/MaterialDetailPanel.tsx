import {
  attachmentKindLabel,
  getMaterialAttachmentPath,
  getMaterialFolderPath,
  type OpenLibraryResult,
  removeMaterialAttachment,
} from "@certtrace/library-engine";
import type { AttachedFile, MaterialMetadataV1 } from "@certtrace/types";
import {
  Button,
  cn,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@certtrace/ui";
import { FileText, FolderOpen, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { attachFilesToMaterial, pickAttachmentFiles } from "../lib/attachment-client";
import {
  openPathWithOpener,
  printLabelPdfFromObjectUrl,
  saveLabelPdfViaDialog,
} from "../lib/label-client";
import {
  addLibraryFieldOption,
  fetchMaterialAttachments,
  updateMaterialMetadata,
} from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import {
  type MaterialFormValues,
  MaterialSchemaForm,
  validateMaterialValues,
} from "./MaterialSchemaForm";

interface MaterialDetailPanelProps {
  library: OpenLibraryResult;
  material: MaterialMetadataV1;
  open: boolean;
  wideLayout?: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialUpdated: (material: MaterialMetadataV1) => void;
}

export function MaterialDetailPanel({
  library,
  material,
  open,
  wideLayout = false,
  onOpenChange,
  onMaterialUpdated,
}: MaterialDetailPanelProps) {
  const [draft, setDraft] = useState<MaterialFormValues>({
    fields: material.fields,
    identifiers: material.identifiers,
  });
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [labelPdfUrl, setLabelPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft({ fields: material.fields, identifiers: material.identifiers });
  }, [material]);

  useEffect(() => {
    let cancelled = false;

    void fetchMaterialAttachments(library, material.id)
      .then((result) => {
        if (!cancelled) {
          setAttachments(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [library, material.id]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadLabelPreview() {
      const { generateStandardQrLabelPdfBytes } = await import("../lib/label-client");
      const bytes = await generateStandardQrLabelPdfBytes(material);
      objectUrl = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
      );
      if (!cancelled) {
        setLabelPdfUrl(objectUrl);
      }
    }

    void loadLabelPreview();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [material]);

  useEffect(() => {
    return () => {
      if (labelPdfUrl) {
        URL.revokeObjectURL(labelPdfUrl);
      }
    };
  }, [labelPdfUrl]);

  async function handleSave() {
    const validationErrors = validateMaterialValues(
      library.fieldSchema,
      draft.fields,
      draft.identifiers,
    );
    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await updateMaterialMetadata(library, material.id, {
        fields: draft.fields,
        identifiers: draft.identifiers,
      });
      onMaterialUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddFiles() {
    const paths = await pickAttachmentFiles();
    if (paths.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setAttachments(await attachFilesToMaterial(library, material.id, paths));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintLabel() {
    if (!labelPdfUrl) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await printLabelPdfFromObjectUrl(labelPdfUrl, material.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAttachment(filename: string) {
    setBusy(true);
    setError(null);
    try {
      await removeMaterialAttachment(library, material.id, filename);
      setAttachments(await fetchMaterialAttachments(library, material.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenAttachment(file: AttachedFile) {
    setBusy(true);
    setError(null);
    try {
      await openPathWithOpener(getMaterialAttachmentPath(library, material.id, file.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const header = <h2 className="text-lg font-semibold leading-none">{material.id}</h2>;

  const panel = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {wideLayout ? (
        header
      ) : (
        <SheetHeader>
          <SheetTitle>{material.id}</SheetTitle>
        </SheetHeader>
      )}

      <MaterialSchemaForm
        schema={library.fieldSchema}
        values={draft}
        onChange={setDraft}
        onAddOption={(input) => addLibraryFieldOption(library, input)}
        idPrefix="detail-material"
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void handleSave()}>
          Save changes
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void handleAddFiles()}
        >
          Add files
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void saveLabelPdfViaDialog(material)}
        >
          Export label PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !labelPdfUrl}
          onClick={() => void handlePrintLabel()}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print label
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void openPathWithOpener(getMaterialFolderPath(library, material.id))}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Open folder
        </Button>
      </div>

      <section>
        <h3 className="text-sm font-semibold">Attachments</h3>
        {attachments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No attachments yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {attachments.map((file) => (
              <li
                key={file.name}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
              >
                <button
                  type="button"
                  className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => void handleOpenAttachment(file)}
                >
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-slate-500">{attachmentKindLabel(file.kind)}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemoveAttachment(file.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Label preview</h3>
        {labelPdfUrl ? (
          <div className="mt-2 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <iframe src={labelPdfUrl} title="Label preview" className="h-40 w-full bg-white" />
          </div>
        ) : null}
      </section>

      {error ? <ErrorBanner message={error} /> : null}
    </div>
  );

  if (wideLayout) {
    return open ? (
      <aside className="flex h-full w-[28rem] shrink-0 flex-col border-l border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {panel}
      </aside>
    ) : null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("overflow-y-auto")}>
        <SheetClose />
        {panel}
      </SheetContent>
    </Sheet>
  );
}
