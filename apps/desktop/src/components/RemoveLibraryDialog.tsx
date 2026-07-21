import type { RecentLibraryEntryV1 } from "@certtrace/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
} from "@certtrace/ui";
import { useState } from "react";

interface RemoveLibraryDialogProps {
  entry: RecentLibraryEntryV1 | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (path: string, deleteFolder: boolean) => void;
}

export function RemoveLibraryDialog({
  entry,
  busy = false,
  onClose,
  onConfirm,
}: RemoveLibraryDialogProps) {
  const [deleteFolder, setDeleteFolder] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setDeleteFolder(false);
      onClose();
    }
  }

  return (
    <Dialog open={entry !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {entry?.name ?? "library"}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This removes the library from CertTrace. Your materials stay on disk unless you choose to
          delete the folder too.
        </p>
        {entry ? (
          <p className="rounded-md border border-slate-200 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700">
            {entry.path}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3 dark:border-slate-700">
          <div>
            <Label htmlFor="delete-library-folder">Delete folder from disk</Label>
            <p className="text-xs text-slate-500">
              Permanently delete the library folder and everything inside it.
            </p>
          </div>
          <Switch
            id="delete-library-folder"
            checked={deleteFolder}
            onCheckedChange={setDeleteFolder}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setDeleteFolder(false);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={deleteFolder ? "default" : "outline"}
            disabled={busy || !entry}
            onClick={() => entry && onConfirm(entry.path, deleteFolder)}
          >
            {busy ? "Removing…" : deleteFolder ? "Remove and delete folder" : "Remove from app"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
