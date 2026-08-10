import { filterJobsByCustomer, type OpenLibraryResult } from "@certtrace/library-engine";
import type { JobMetadataV1, MaterialMetadataV1 } from "@certtrace/types";
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@certtrace/ui";
import { Briefcase, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActiveLibraryPath } from "../hooks/useLibrarySession";
import {
  addJob,
  assignMaterialToJob,
  deleteJob,
  fetchAssignedMaterialIds,
  fetchJobCustomers,
  fetchJobs,
  fetchMaterials,
  fetchMaterialsForJob,
  unassignMaterialFromJob,
  updateJobMetadata,
} from "../lib/library-client";
import { DeleteJobDialog } from "./DeleteJobDialog";
import { ErrorBanner } from "./ErrorBanner";
import { UnassignJobMaterialDialog } from "./UnassignJobMaterialDialog";

interface JobsWorkspaceProps {
  sessionLibraries: Map<string, OpenLibraryResult>;
  activeLibraryPath: ActiveLibraryPath;
  error?: string | null;
}

interface JobFormState {
  jobNumber: string;
  jobDate: string;
  customer: string;
  notes: string;
}

const emptyForm: JobFormState = {
  jobNumber: "",
  jobDate: "",
  customer: "",
  notes: "",
};

export function JobsWorkspace({
  sessionLibraries,
  activeLibraryPath,
  error = null,
}: JobsWorkspaceProps) {
  const activeLibrary =
    activeLibraryPath && activeLibraryPath !== "all"
      ? (sessionLibraries.get(activeLibraryPath) ?? null)
      : null;

  const [jobs, setJobs] = useState<JobMetadataV1[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobMetadataV1 | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobMetadataV1 | null>(null);
  const [deleteLinkedMaterialIds, setDeleteLinkedMaterialIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [linkedMaterials, setLinkedMaterials] = useState<MaterialMetadataV1[]>([]);
  const [allMaterials, setAllMaterials] = useState<MaterialMetadataV1[]>([]);
  const [assignMaterialId, setAssignMaterialId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<MaterialMetadataV1 | null>(null);
  const [unassigning, setUnassigning] = useState(false);
  const customerListId = "job-customer-suggestions";

  const refresh = useCallback(async () => {
    if (!activeLibrary) {
      setJobs([]);
      setCustomers([]);
      return;
    }
    setLoading(true);
    setLocalError(null);
    try {
      const [nextJobs, nextCustomers] = await Promise.all([
        fetchJobs(activeLibrary),
        fetchJobCustomers(activeLibrary),
      ]);
      setJobs(nextJobs);
      setCustomers(nextCustomers);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeLibrary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshLinkedMaterials = useCallback(
    async (jobId: string) => {
      if (!activeLibrary) {
        setLinkedMaterials([]);
        return;
      }
      const [linked, materials] = await Promise.all([
        fetchMaterialsForJob(activeLibrary, jobId),
        fetchMaterials(activeLibrary),
      ]);
      setLinkedMaterials(linked);
      setAllMaterials(materials);
      setAssignMaterialId("");
    },
    [activeLibrary],
  );

  const filteredJobs = useMemo(
    () => filterJobsByCustomer(jobs, customerQuery),
    [customerQuery, jobs],
  );

  const assignableMaterials = useMemo(() => {
    const linkedIds = new Set(linkedMaterials.map((material) => material.id));
    return allMaterials.filter((material) => !linkedIds.has(material.id));
  }, [allMaterials, linkedMaterials]);

  function openCreate() {
    setEditingJob(null);
    setForm(emptyForm);
    setLinkedMaterials([]);
    setAllMaterials([]);
    setAssignMaterialId("");
    setLocalError(null);
    setFormOpen(true);
  }

  function openEdit(job: JobMetadataV1) {
    setEditingJob(job);
    setForm({
      jobNumber: job.jobNumber,
      jobDate: job.jobDate,
      customer: job.customer ?? "",
      notes: job.notes ?? "",
    });
    setLocalError(null);
    setFormOpen(true);
    void refreshLinkedMaterials(job.id).catch((err) => {
      setLocalError(err instanceof Error ? err.message : String(err));
    });
  }

  async function handleSave() {
    if (!activeLibrary) {
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      if (editingJob) {
        await updateJobMetadata(activeLibrary, editingJob.id, {
          jobNumber: form.jobNumber,
          jobDate: form.jobDate,
          customer: form.customer,
          notes: form.notes,
        });
      } else {
        await addJob(activeLibrary, {
          jobNumber: form.jobNumber,
          jobDate: form.jobDate,
          customer: form.customer,
          notes: form.notes,
        });
      }
      setFormOpen(false);
      setEditingJob(null);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function openDelete(job: JobMetadataV1) {
    if (!activeLibrary) {
      return;
    }
    setLocalError(null);
    try {
      setDeleteLinkedMaterialIds(await fetchAssignedMaterialIds(activeLibrary, job.id));
      setDeleteTarget(job);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    if (!activeLibrary || !deleteTarget) {
      return;
    }
    setDeleting(true);
    setLocalError(null);
    try {
      await deleteJob(activeLibrary, deleteTarget.id);
      setDeleteTarget(null);
      setDeleteLinkedMaterialIds([]);
      await refresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssign() {
    if (!activeLibrary || !editingJob || !assignMaterialId) {
      return;
    }
    setAssigning(true);
    setLocalError(null);
    try {
      await assignMaterialToJob(activeLibrary, editingJob.id, assignMaterialId);
      await refreshLinkedMaterials(editingJob.id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!activeLibrary || !editingJob || !unassignTarget) {
      return;
    }
    setUnassigning(true);
    setLocalError(null);
    try {
      await unassignMaterialFromJob(activeLibrary, editingJob.id, unassignTarget.id);
      setUnassignTarget(null);
      await refreshLinkedMaterials(editingJob.id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setUnassigning(false);
    }
  }

  const singleLibraryReady = Boolean(activeLibrary);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <SearchInput
            id="jobs-customer-filter"
            value={customerQuery}
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="Find by customer…"
            className="min-w-[16rem]"
            disabled={!singleLibraryReady}
          />
          <Button
            type="button"
            className="shrink-0"
            disabled={!singleLibraryReady}
            onClick={openCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add job
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {!singleLibraryReady ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a single library to view and manage Jobs.
            </p>
          </div>
        ) : loading ? (
          <p className="text-sm text-slate-500">Loading jobs…</p>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {jobs.length === 0
                ? "No jobs yet. Add your first job for this library."
                : "No jobs match that customer."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job number</TableHead>
                  <TableHead>Job date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => openEdit(job)}>
                    <TableCell className="font-medium">{job.jobNumber}</TableCell>
                    <TableCell>{job.jobDate}</TableCell>
                    <TableCell>{job.customer ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-slate-600 dark:text-slate-400">
                      {job.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openDelete(job);
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!formOpen && (error || localError) ? (
          <div className="mt-4">
            <ErrorBanner message={error ?? localError ?? ""} />
          </div>
        ) : null}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingJob(null);
            setForm(emptyForm);
            setLinkedMaterials([]);
            setAssignMaterialId("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit job" : "Add job"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-number">Job number</Label>
              <Input
                id="job-number"
                value={form.jobNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, jobNumber: event.target.value }))
                }
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-date">Job date</Label>
              <Input
                id="job-date"
                type="date"
                value={form.jobDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, jobDate: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-customer">Customer</Label>
              <Input
                id="job-customer"
                list={customerListId}
                value={form.customer}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customer: event.target.value }))
                }
                autoComplete="off"
              />
              <datalist id={customerListId}>
                {customers.map((customer) => (
                  <option key={customer} value={customer} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-notes">Notes</Label>
              <Textarea
                id="job-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
              />
            </div>

            {editingJob ? (
              <section className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <h3 className="text-sm font-semibold">Materials</h3>
                {linkedMaterials.length === 0 ? (
                  <p className="text-sm text-slate-500">No materials assigned yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {linkedMaterials.map((material) => (
                      <li
                        key={material.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                      >
                        <span className="truncate font-mono">
                          {material.id}
                          {material.archived ? " (archived)" : ""}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUnassignTarget(material)}
                        >
                          Unlink
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="assign-material">Assign material</Label>
                    <Select
                      id="assign-material"
                      value={assignMaterialId}
                      disabled={assignableMaterials.length === 0 || assigning}
                      onChange={(event) => setAssignMaterialId(event.target.value)}
                    >
                      <option value="">
                        {assignableMaterials.length === 0
                          ? "No materials available"
                          : "Select a material…"}
                      </option>
                      {assignableMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.id}
                          {material.archived ? " (archived)" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!assignMaterialId || assigning}
                    onClick={() => void handleAssign()}
                  >
                    Assign
                  </Button>
                </div>
              </section>
            ) : null}

            {localError ? <ErrorBanner message={localError} /> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleSave()}>
              {editingJob ? "Save job" : "Add job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteTarget ? (
        <DeleteJobDialog
          open
          jobNumber={deleteTarget.jobNumber}
          linkedMaterialIds={deleteLinkedMaterialIds}
          busy={deleting}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteLinkedMaterialIds([]);
          }}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {editingJob && unassignTarget ? (
        <UnassignJobMaterialDialog
          open
          jobNumber={editingJob.jobNumber}
          materialId={unassignTarget.id}
          busy={unassigning}
          onClose={() => setUnassignTarget(null)}
          onConfirm={() => void handleUnassign()}
        />
      ) : null}
    </div>
  );
}
