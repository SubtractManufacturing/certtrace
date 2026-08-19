import { Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle } from "@certtrace/ui";
import type { LibraryArchiveProgress } from "../lib/library-archive-client";

interface LibraryArchiveProgressDialogProps {
  open: boolean;
  progress: LibraryArchiveProgress | null;
  cancelling?: boolean;
  onCancel: () => void;
}

export function LibraryArchiveProgressDialog({
  open,
  progress,
  cancelling = false,
  onCancel,
}: LibraryArchiveProgressDialogProps) {
  const total = progress?.total ?? 0;
  const current = progress?.current ?? 0;
  const preparing = total === 0;
  const percent = preparing ? 0 : Math.min(100, Math.round((current / total) * 100));
  const status = preparing ? "Preparing…" : `Copying ${current} of ${total} files`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          return;
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copying library files</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">{status}</p>
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={preparing ? undefined : percent}
          aria-label={status}
        >
          <div
            className={cn(
              "h-full bg-sky-500 transition-[width] duration-300 ease-out dark:bg-sky-400",
              preparing && "w-1/3 animate-pulse",
            )}
            style={preparing ? undefined : { width: `${percent}%` }}
          />
        </div>
        {progress?.relativePath ? (
          <p className="truncate font-mono text-xs text-slate-500" title={progress.relativePath}>
            {progress.relativePath}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="button" variant="outline" disabled={cancelling} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
