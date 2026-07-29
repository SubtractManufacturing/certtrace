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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
} from "@certtrace/ui";
import { FileText, FolderOpen, Pencil, Plus, Printer, Share2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  attachFilesToMaterial,
  deleteAttachment,
  pickAttachmentFiles,
  renameAttachment,
  revealAttachmentInFolder,
} from "../lib/attachment-client";
import {
  generateStandardQrLabelPdfBytes,
  openPathWithOpener,
  printLabelPdf,
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

interface PendingAttachment {
  sourcePath: string;
  kindKey: string;
}

interface MaterialDetailPanelProps {
  library: OpenLibraryResult;
  material: MaterialMetadataV1;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialUpdated: (material: MaterialMetadataV1) => void;
}

function attachmentFilename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function MaterialDetailPanel({
  library,
  material,
  open,
  onOpenChange,
  onMaterialUpdated,
}: MaterialDetailPanelProps) {
  const defaultAttachmentKind = library.fieldSchema.attachmentKinds[0]?.key ?? "";
  const [draft, setDraft] = useState<MaterialFormValues>({
    fields: material.fields,
    identifiers: material.identifiers,
  });
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
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

  function resetDraft() {
    setDraft({ fields: material.fields, identifiers: material.identifiers });
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDraft();
      setUploadDialogOpen(false);
      setPendingAttachments([]);
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

  async function handleChooseAttachments() {
    const paths = await pickAttachmentFiles();
    if (paths.length === 0) {
      return;
    }

    setPendingAttachments(
      paths.map((sourcePath) => ({
        sourcePath,
        kindKey: defaultAttachmentKind,
      })),
    );
    setUploadDialogOpen(true);
  }

  function handleUploadDialogOpenChange(nextOpen: boolean) {
    setUploadDialogOpen(nextOpen);
    if (!nextOpen) {
      setPendingAttachments([]);
    }
  }

  function updatePendingAttachmentKind(sourcePath: string, kindKey: string) {
    setPendingAttachments((current) =>
      current.map((entry) =>
        entry.sourcePath === sourcePath ? { ...entry, kindKey } : entry,
      ),
    );
  }

  async function handleConfirmAttachments() {
    if (pendingAttachments.length === 0) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await attachFilesToMaterial(
        library,
        material.id,
        pendingAttachments.map((entry) => ({
          sourcePath: entry.sourcePath,
          kindKey: entry.kindKey || undefined,
        })),
      );
      setAttachments(await fetchMaterialAttachments(library, material.id));
      setUploadDialogOpen(false);
      setPendingAttachments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintLabel() {
    setBusy(true);
    setError(null);
    try {
      const bytes = await generateStandardQrLabelPdfBytes(material);
      await printLabelPdf(bytes, material.id);
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

  const hasAttachmentKinds = library.fieldSchema.attachmentKinds.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,100dvh-2rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden lg:max-w-4xl">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>{material.id}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
            <MaterialSchemaForm
              schema={library.fieldSchema}
              values={draft}
              onChange={setDraft}
              onAddOption={(input) => addLibraryFieldOption(library, input)}
              idPrefix="detail-material"
            />

            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Attachments</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleChooseAttachments()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add attachments
                </Button>
              </div>
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
                          {library.fieldSchema.attachmentKinds.find(
                            (kind) => kind.key === file.kindKey,
                          )?.label ?? "Uncategorized"}
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
              <h3 className="text-sm font-semibold">Label</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Export or print the QR label for this material.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
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
                  disabled={busy}
                  onClick={() => void handlePrintLabel()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print label
                </Button>
              </div>
            </section>

            {error ? <ErrorBanner message={error} /> : null}
          </div>

          <DialogFooter className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label="Open material folder"
              onClick={() => void openPathWithOpener(getMaterialFolderPath(library, material.id))}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void handleSave()}>
                Save changes
              </Button>
            </div>
          </DialogFooter>

          <DialogClose aria-label="Cancel">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={handleUploadDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Attach files</DialogTitle>
            <DialogDescription>
              Choose a type for each file before adding them to this material.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3">
            {pendingAttachments.map((entry) => {
              const filename = attachmentFilename(entry.sourcePath);
              return (
                <li
                  key={entry.sourcePath}
                  className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate text-sm">{filename}</span>
                  {hasAttachmentKinds ? (
                    <Select
                      aria-label={`Type for ${filename}`}
                      value={entry.kindKey}
                      disabled={busy}
                      className="w-36"
                      onChange={(event) =>
                        updatePendingAttachmentKind(entry.sourcePath, event.target.value)
                      }
                    >
                      {library.fieldSchema.attachmentKinds.map((kind) => (
                        <option key={kind.key} value={kind.key}>
                          {kind.label}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => handleUploadDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleConfirmAttachments()}>
              Attach files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
