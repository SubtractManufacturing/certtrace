import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@certtrace/ui";

interface ArchiveMaterialDialogProps {
  open: boolean;
  materialId: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArchiveMaterialDialog({
  open,
  materialId,
  busy = false,
  onClose,
  onConfirm,
}: ArchiveMaterialDialogProps) {
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
          <DialogTitle>Archive material {materialId}?</DialogTitle>
          <DialogDescription>
            Archived materials leave the active shelf but stay in this library with the same id and
            attachments. You can restore them later. Hard delete remains available for mistakes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            Archive material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
