import { useEffect, useMemo, useState } from "react";
import {
  attachmentKindLabel,
  getMaterialAttachmentPath,
  getMaterialFolderPath,
  removeMaterialAttachment,
  type OpenLibraryResult,
} from "@certtrace/library-engine";
import type { AttachedFile, MaterialMetadataV1 } from "@certtrace/types";
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
  cn,
} from "@certtrace/ui";
import { FileText, FolderOpen, Printer, Trash2 } from "lucide-react";
import {
  attachFilesToMaterial,
  pickAttachmentFiles,
  readBinaryFile,
} from "../lib/attachment-client";
import {
  fetchMaterialAttachments,
  updateMaterialMetadata,
} from "../lib/library-client";
import {
  openPathWithOpener,
  printLabelPdfFromObjectUrl,
  saveLabelPdfViaDialog,
} from "../lib/label-client";
import { ErrorBanner } from "./ErrorBanner";

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
  const [draft, setDraft] = useState(material);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "pdf" | null>(null);
  const [labelPdfUrl, setLabelPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(material);
  }, [material]);

  useEffect(() => {
    void fetchMaterialAttachments(library, material.id)
      .then(setAttachments)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [library, material.id]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadLabelPreview() {
      const { generateStandardQrLabelPdfBytes } = await import("../lib/label-client");
      const bytes = await generateStandardQrLabelPdfBytes(material);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
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
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (labelPdfUrl) {
        URL.revokeObjectURL(labelPdfUrl);
      }
    };
  }, [labelPdfUrl, previewUrl]);

  const tagsValue = useMemo(() => draft.tags.join(", "), [draft.tags]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMaterialMetadata(library, material.id, {
        material: draft.material,
        supplier: draft.supplier,
        heat: draft.heat,
        location: draft.location,
        notes: draft.notes,
        tags: draft.tags,
        barcode: draft.barcode,
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
      if (previewUrl?.includes(filename)) {
        setPreviewUrl(null);
        setPreviewKind(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePreviewAttachment(file: AttachedFile) {
    const path = getMaterialAttachmentPath(library, material.id, file.name);
    const bytes = await readBinaryFile(path);
    const mime =
      file.kind === "pdf"
        ? "application/pdf"
        : file.kind === "png"
          ? "image/png"
          : file.kind === "jpg" || file.kind === "jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return url;
    });
    setPreviewKind(file.kind === "pdf" ? "pdf" : "image");
  }

  const header = <h2 className="text-lg font-semibold leading-none">{material.id}</h2>;

  const panel = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {wideLayout ? header : (
        <SheetHeader>
          <SheetTitle>{material.id}</SheetTitle>
        </SheetHeader>
      )}

      <div className="grid gap-3">
        <Field label="Material" value={draft.material} onChange={(value) => setDraft({ ...draft, material: value })} />
        <Field label="Supplier" value={draft.supplier} onChange={(value) => setDraft({ ...draft, supplier: value })} />
        <Field label="Heat" value={draft.heat} onChange={(value) => setDraft({ ...draft, heat: value })} />
        <Field label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} />
        <Field label="Barcode" value={draft.barcode} onChange={(value) => setDraft({ ...draft, barcode: value })} />
        <label className="space-y-1 text-sm">
          <Label>Tags</Label>
          <Input
            value={tagsValue}
            onChange={(event) =>
              setDraft({
                ...draft,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <Label>Notes</Label>
          <Textarea
            rows={4}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void handleSave()}>
          Save changes
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void handleAddFiles()}>
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
                  onClick={() => void handlePreviewAttachment(file)}
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

      {previewUrl ? (
        <section>
          <h3 className="text-sm font-semibold">Preview</h3>
          <div className="mt-2 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            {previewKind === "pdf" ? (
              <iframe src={previewUrl} title="PDF preview" className="h-64 w-full bg-white" />
            ) : (
              <img src={previewUrl} alt="Attachment preview" className="max-h-64 w-full object-contain" />
            )}
          </div>
        </section>
      ) : null}

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

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
