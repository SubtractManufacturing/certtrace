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
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMaterialDialog({
  open,
  materialId,
  attachmentCount,
  busy = false,
  onClose,
  onConfirm,
}: DeleteMaterialDialogProps) {
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
            {attachmentCount === 1 ? "1 attachment" : `${attachmentCount} attachments`}. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
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
