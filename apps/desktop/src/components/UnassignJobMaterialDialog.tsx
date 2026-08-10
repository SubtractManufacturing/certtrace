import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@certtrace/ui";

interface UnassignJobMaterialDialogProps {
  open: boolean;
  jobNumber: string;
  materialId: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UnassignJobMaterialDialog({
  open,
  jobNumber,
  materialId,
  busy = false,
  onClose,
  onConfirm,
}: UnassignJobMaterialDialogProps) {
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
          <DialogTitle>Unlink material from job?</DialogTitle>
          <DialogDescription>
            Remove the historical Job assignment between job {jobNumber} and material {materialId}.
            The Job and Material records stay in the library.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            Unlink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
