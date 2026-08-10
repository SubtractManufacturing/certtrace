import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@certtrace/ui";

interface DeleteJobDialogProps {
  open: boolean;
  jobNumber: string;
  /** Material ids that will lose this Job assignment when the Job is deleted. */
  linkedMaterialIds?: string[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteJobDialog({
  open,
  jobNumber,
  linkedMaterialIds = [],
  busy = false,
  onClose,
  onConfirm,
}: DeleteJobDialogProps) {
  const linkCount = linkedMaterialIds.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete job {jobNumber}?</DialogTitle>
          <DialogDescription>
            This permanently removes the Job from the library
            {linkCount > 0
              ? `, including ${linkCount === 1 ? "1 Job assignment" : `${linkCount} Job assignments`}`
              : ""}
            . This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {linkCount > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Assignments that will be removed</p>
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {linkedMaterialIds.map((materialId) => (
                <li key={materialId}>{materialId}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="border-red-600 bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            Delete job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
