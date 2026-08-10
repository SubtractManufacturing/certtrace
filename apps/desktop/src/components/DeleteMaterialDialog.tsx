import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@certtrace/ui";

interface DeleteMaterialDialogProps {
  open: boolean;
  materialId: string;
  attachmentCount: number;
  /** Job numbers that will lose this Material assignment when the Material is deleted. */
  linkedJobNumbers?: string[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMaterialDialog({
  open,
  materialId,
  attachmentCount,
  linkedJobNumbers = [],
  busy = false,
  onClose,
  onConfirm,
}: DeleteMaterialDialogProps) {
  const jobCount = linkedJobNumbers.length;

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
          <DialogTitle>Delete material {materialId}?</DialogTitle>
          <DialogDescription>
            This permanently removes the material folder from the library, including metadata and{" "}
            {attachmentCount === 1 ? "1 attachment" : `${attachmentCount} attachments`}
            {jobCount > 0
              ? `, and ${jobCount === 1 ? "1 Job assignment" : `${jobCount} Job assignments`}`
              : ""}
            . This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {jobCount > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Jobs that will lose this assignment</p>
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {linkedJobNumbers.map((jobNumber) => (
                <li key={jobNumber}>{jobNumber}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="rounded-md border border-slate-200 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700">
          materials/{materialId}/
        </p>
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
            Delete material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
