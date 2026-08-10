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
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteJobDialog({
  open,
  jobNumber,
  busy = false,
  onClose,
  onConfirm,
}: DeleteJobDialogProps) {
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
            This permanently removes the Job from the library. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
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
