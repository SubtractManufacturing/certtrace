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
  Input,
  Label,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@certtrace/ui";
import { FileText, FolderOpen, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { attachFilesToMaterial, pickAttachmentFiles } from "../lib/attachment-client";
import {
  openPathWithOpener,
  printLabelPdfFromObjectUrl,
  saveLabelPdfViaDialog,
} from "../lib/label-client";
import { fetchMaterialAttachments, updateMaterialMetadata } from "../lib/library-client";
import { fieldDisplay, identifierDisplay } from "../lib/material-display";
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
  const [labelPdfUrl, setLabelPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(material);
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

  function setField(key: string, value: string) {
    setDraft({
      ...draft,
      fields: { ...draft.fields, [key]: value },
    });
  }

  function setIdentifier(key: string, value: string) {
    setDraft({
      ...draft,
      identifiers: { ...draft.identifiers, [key]: value },
    });
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

      <div className="grid gap-3">
        <Field
          label="Material"
          value={fieldDisplay(draft, "family")}
          onChange={(value) => setField("family", value)}
        />
        <Field
          label="Alloy"
          value={fieldDisplay(draft, "alloy")}
          onChange={(value) => setField("alloy", value)}
        />
        <Field
          label="Temper"
          value={fieldDisplay(draft, "temper")}
          onChange={(value) => setField("temper", value)}
        />
        <Field
          label="Supplier"
          value={fieldDisplay(draft, "supplier")}
          onChange={(value) => setField("supplier", value)}
        />
        <Field
          label="Heat Number"
          value={identifierDisplay(draft, "heat_number")}
          onChange={(value) => setIdentifier("heat_number", value)}
        />
        <Field
          label="Lot Number"
          value={identifierDisplay(draft, "lot_number")}
          onChange={(value) => setIdentifier("lot_number", value)}
        />
        <Field
          label="Purchase Order"
          value={identifierDisplay(draft, "purchase_order")}
          onChange={(value) => setIdentifier("purchase_order", value)}
        />
        <Field
          label="Storage Location"
          value={fieldDisplay(draft, "storage_location")}
          onChange={(value) => setField("storage_location", value)}
        />
        <label className="space-y-1 text-sm">
          <Label>Notes</Label>
          <Textarea
            rows={4}
            value={fieldDisplay(draft, "notes")}
            onChange={(event) => setField("notes", event.target.value)}
          />
        </label>
      </div>

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
