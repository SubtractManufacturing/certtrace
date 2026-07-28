import {
  attachmentFormatLabel,
  getMaterialAttachmentPath,
  getMaterialFolderPath,
  type OpenLibraryResult,
} from "@certtrace/library-engine";
import type { AttachedFile, MaterialMetadataV1 } from "@certtrace/types";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
} from "@certtrace/ui";
import { FileText, FolderOpen, Pencil, Printer, Share2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  attachFilesToMaterial,
  deleteAttachment,
  pickAttachmentFiles,
  renameAttachment,
  revealAttachmentInFolder,
} from "../lib/attachment-client";
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
  onOpenChange: (open: boolean) => void;
  onMaterialUpdated: (material: MaterialMetadataV1) => void;
}

export function MaterialDetailPanel({
  library,
  material,
  open,
  onOpenChange,
  onMaterialUpdated,
}: MaterialDetailPanelProps) {
  const [draft, setDraft] = useState<MaterialFormValues>({
    fields: material.fields,
    identifiers: material.identifiers,
  });
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [labelPdfUrl, setLabelPdfUrl] = useState<string | null>(null);
  const [attachmentKindKey, setAttachmentKindKey] = useState(
    library.fieldSchema.attachmentKinds[0]?.key ?? "",
  );
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

  function resetDraft() {
    setDraft({ fields: material.fields, identifiers: material.identifiers });
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDraft();
    }
    onOpenChange(nextOpen);
  }

  function handleCancel() {
    resetDraft();
    onOpenChange(false);
  }

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
      onOpenChange(false);
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
      await attachFilesToMaterial(library, material.id, paths, attachmentKindKey || undefined);
      setAttachments(await fetchMaterialAttachments(library, material.id));
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
      await deleteAttachment(library, material.id, filename);
      setAttachments(await fetchMaterialAttachments(library, material.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameAttachment(file: AttachedFile) {
    const nextFilename = window.prompt("Rename attachment", file.name)?.trim();
    if (!nextFilename || nextFilename === file.name) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renameAttachment(library, material.id, file.name, nextFilename);
      setAttachments(await fetchMaterialAttachments(library, material.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealAttachment(file: AttachedFile) {
    setBusy(true);
    setError(null);
    try {
      await revealAttachmentInFolder(library, material.id, file.name);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,100dvh-2rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden lg:max-w-4xl"
      >
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>{material.id}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <MaterialSchemaForm
            schema={library.fieldSchema}
            values={draft}
            onChange={setDraft}
            onAddOption={(input) => addLibraryFieldOption(library, input)}
            idPrefix="detail-material"
          />

          <div className="flex flex-wrap gap-2">
            {library.fieldSchema.attachmentKinds.length > 0 ? (
              <Select
                aria-label="Attachment kind"
                value={attachmentKindKey}
                disabled={busy}
                onChange={(event) => setAttachmentKindKey(event.target.value)}
                className="w-auto"
              >
                {library.fieldSchema.attachmentKinds.map((kind) => (
                  <option key={kind.key} value={kind.key}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            ) : null}
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
                      <span className="text-xs text-slate-500">
                        {library.fieldSchema.attachmentKinds.find((kind) => kind.key === file.kindKey)
                          ?.label ?? "Uncategorized"}
                        {" · "}
                        {attachmentFormatLabel(file.format)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Rename ${file.name}`}
                      onClick={() => void handleRenameAttachment(file)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Share ${file.name}`}
                      onClick={() => void handleRevealAttachment(file)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${file.name}`}
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

        <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <Button type="button" variant="outline" disabled={busy} onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSave()}>
            Save changes
          </Button>
        </DialogFooter>

        <DialogClose aria-label="Cancel">
          <X className="h-4 w-4" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
