import {
  attachmentFormatLabel,
  getMaterialAttachmentPath,
  getMaterialFolderPath,
  type OpenLibraryResult,
} from "@certtrace/library-engine";
import type { AttachedFile, JobMetadataV1, MaterialMetadataV1 } from "@certtrace/types";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
} from "@certtrace/ui";
import {
  Archive,
  ArchiveRestore,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  attachFilesToMaterial,
  deleteAttachment,
  pickAttachmentFiles,
  renameAttachment,
  revealAttachmentInFolder,
} from "../lib/attachment-client";
import { openPathWithOpener } from "../lib/label-client";
import {
  addLibraryFieldOption,
  archiveMaterial,
  assignMaterialToJob,
  deleteMaterial,
  fetchJobs,
  fetchJobsForMaterial,
  fetchMaterialAttachments,
  unarchiveMaterial,
  unassignMaterialFromJob,
  updateMaterialMetadata,
} from "../lib/library-client";
import { ArchiveMaterialDialog } from "./ArchiveMaterialDialog";
import { DeleteMaterialDialog } from "./DeleteMaterialDialog";
import { ErrorBanner } from "./ErrorBanner";
import { LabelPreviewDialog } from "./LabelPreviewDialog";
import {
  type MaterialFormValues,
  MaterialSchemaForm,
  validateMaterialValues,
} from "./MaterialSchemaForm";
import { UnassignJobMaterialDialog } from "./UnassignJobMaterialDialog";

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
  onEditLabelTemplates: () => void;
  onMaterialDeleted: (materialId: string) => void | Promise<void>;
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
  onEditLabelTemplates,
  onMaterialDeleted,
}: MaterialDetailPanelProps) {
  const defaultAttachmentKind = library.fieldSchema.attachmentKinds[0]?.key ?? "";
  const [draft, setDraft] = useState<MaterialFormValues>({
    fields: material.fields,
    identifiers: material.identifiers,
  });
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<AttachedFile | null>(null);
  const [renameFilename, setRenameFilename] = useState("");
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkedJobs, setLinkedJobs] = useState<JobMetadataV1[]>([]);
  const [allJobs, setAllJobs] = useState<JobMetadataV1[]>([]);
  const [assignJobId, setAssignJobId] = useState("");
  const [unassignTarget, setUnassignTarget] = useState<JobMetadataV1 | null>(null);
  const [deleteLinkedJobNumbers, setDeleteLinkedJobNumbers] = useState<string[]>([]);

  useEffect(() => {
    setDraft({ fields: material.fields, identifiers: material.identifiers });
  }, [material]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetchMaterialAttachments(library, material.id),
      fetchJobsForMaterial(library, material.id),
      fetchJobs(library),
    ])
      .then(([nextAttachments, nextLinkedJobs, nextJobs]) => {
        if (!cancelled) {
          setAttachments(nextAttachments);
          setLinkedJobs(nextLinkedJobs);
          setAllJobs(nextJobs);
          setAssignJobId("");
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

  const assignableJobs = useMemo(() => {
    const linkedIds = new Set(linkedJobs.map((job) => job.id));
    return allJobs.filter((job) => !linkedIds.has(job.id));
  }, [allJobs, linkedJobs]);

  async function refreshLinkedJobs() {
    const [nextLinkedJobs, nextJobs] = await Promise.all([
      fetchJobsForMaterial(library, material.id),
      fetchJobs(library),
    ]);
    setLinkedJobs(nextLinkedJobs);
    setAllJobs(nextJobs);
    setAssignJobId("");
  }

  function resetDraft() {
    setDraft({ fields: material.fields, identifiers: material.identifiers });
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDraft();
      setUploadDialogOpen(false);
      setRenameDialogOpen(false);
      setRenamingFile(null);
      setPendingAttachments([]);
      setLabelPreviewOpen(false);
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
      current.map((entry) => (entry.sourcePath === sourcePath ? { ...entry, kindKey } : entry)),
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

  async function openDeleteMaterialDialog() {
    setBusy(true);
    setError(null);
    try {
      const jobs = await fetchJobsForMaterial(library, material.id);
      setDeleteLinkedJobNumbers(jobs.map((job) => job.jobNumber));
      setLinkedJobs(jobs);
      setDeleteDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMaterial() {
    setBusy(true);
    setError(null);
    try {
      await deleteMaterial(library, material.id);
      await onMaterialDeleted(material.id);
      setDeleteDialogOpen(false);
      setDeleteLinkedJobNumbers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignJob() {
    if (!assignJobId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assignMaterialToJob(library, assignJobId, material.id);
      await refreshLinkedJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassignJob() {
    if (!unassignTarget) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await unassignMaterialFromJob(library, unassignTarget.id, material.id);
      setUnassignTarget(null);
      await refreshLinkedJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveMaterial() {
    setBusy(true);
    setError(null);
    try {
      const updated = await archiveMaterial(library, material.id);
      onMaterialUpdated(updated);
      setArchiveDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnarchiveMaterial() {
    setBusy(true);
    setError(null);
    try {
      const updated = await unarchiveMaterial(library, material.id);
      onMaterialUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function openRenameDialog(file: AttachedFile) {
    setRenamingFile(file);
    setRenameFilename(file.name);
    setRenameDialogOpen(true);
  }

  function handleRenameDialogOpenChange(nextOpen: boolean) {
    setRenameDialogOpen(nextOpen);
    if (!nextOpen) {
      setRenamingFile(null);
      setRenameFilename("");
    }
  }

  async function handleConfirmRename() {
    if (!renamingFile) {
      return;
    }

    const nextFilename = renameFilename.trim();
    if (!nextFilename || nextFilename === renamingFile.name) {
      handleRenameDialogOpenChange(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await renameAttachment(library, material.id, renamingFile.name, nextFilename);
      setAttachments(await fetchMaterialAttachments(library, material.id));
      handleRenameDialogOpenChange(false);
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
            <DialogTitle className="flex items-center gap-2">
              <span>{material.id}</span>
              {material.archived ? <Badge variant="secondary">Archived</Badge> : null}
            </DialogTitle>
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
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm transition-colors",
                        "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60",
                      )}
                      onClick={() => void handleOpenAttachment(file)}
                    >
                      <div className="inline-flex min-w-0 flex-1 items-center gap-2 text-left">
                        <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-slate-500">
                          {library.fieldSchema.attachmentKinds.find(
                            (kind) => kind.key === file.kindKey,
                          )?.label ?? "Uncategorized"}
                          {" · "}
                          {attachmentFormatLabel(file.format)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Rename ${file.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRenameDialog(file);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Show ${file.name} in folder`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRevealAttachment(file);
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${file.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRemoveAttachment(file.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold">Jobs</h3>
              {linkedJobs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No jobs assigned yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {linkedJobs.map((job) => (
                    <li
                      key={job.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <span className="truncate">
                        <span className="font-medium">{job.jobNumber}</span>
                        <span className="text-slate-500"> · {job.jobDate}</span>
                        {job.customer ? (
                          <span className="text-slate-500"> · {job.customer}</span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setUnassignTarget(job)}
                      >
                        Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="assign-job">Assign job</Label>
                  <Select
                    id="assign-job"
                    value={assignJobId}
                    disabled={busy || assignableJobs.length === 0}
                    onChange={(event) => setAssignJobId(event.target.value)}
                  >
                    <option value="">
                      {assignableJobs.length === 0 ? "No jobs available" : "Select a job…"}
                    </option>
                    {assignableJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.jobNumber} · {job.jobDate}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !assignJobId}
                  onClick={() => void handleAssignJob()}
                >
                  Assign
                </Button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold">Label</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Preview, export, or print a Label for this material.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setLabelPreviewOpen(true)}
                >
                  Export label PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setLabelPreviewOpen(true)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print label
                </Button>
              </div>
            </section>

            {error ? <ErrorBanner message={error} /> : null}
          </div>

          <DialogFooter className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                aria-label="Delete material"
                className="text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={() => void openDeleteMaterialDialog()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {material.archived ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleUnarchiveMaterial()}
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Unarchive
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setArchiveDialogOpen(true)}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              )}
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
            </div>
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

      <Dialog open={renameDialogOpen} onOpenChange={handleRenameDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename attachment</DialogTitle>
            <DialogDescription>Choose a new filename for this attachment.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rename-attachment-filename">Filename</Label>
            <Input
              id="rename-attachment-filename"
              value={renameFilename}
              disabled={busy}
              autoFocus
              onChange={(event) => setRenameFilename(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleConfirmRename();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => handleRenameDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleConfirmRename()}>
              Rename
            </Button>
          </DialogFooter>
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

      <LabelPreviewDialog
        library={library}
        material={material}
        open={labelPreviewOpen}
        onOpenChange={setLabelPreviewOpen}
        onEditTemplates={() => {
          setLabelPreviewOpen(false);
          onEditLabelTemplates();
        }}
      />

      <DeleteMaterialDialog
        open={deleteDialogOpen}
        materialId={material.id}
        attachmentCount={attachments.length}
        linkedJobNumbers={deleteLinkedJobNumbers}
        busy={busy}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteLinkedJobNumbers([]);
        }}
        onConfirm={() => void handleDeleteMaterial()}
      />

      <ArchiveMaterialDialog
        open={archiveDialogOpen}
        materialId={material.id}
        busy={busy}
        onClose={() => setArchiveDialogOpen(false)}
        onConfirm={() => void handleArchiveMaterial()}
      />

      {unassignTarget ? (
        <UnassignJobMaterialDialog
          open
          jobNumber={unassignTarget.jobNumber}
          materialId={material.id}
          busy={busy}
          onClose={() => setUnassignTarget(null)}
          onConfirm={() => void handleUnassignJob()}
        />
      ) : null}
    </>
  );
}
