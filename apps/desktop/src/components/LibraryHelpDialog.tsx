import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@certtrace/ui";

interface LibraryHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LibraryHelpDialog({
  open,
  onOpenChange,
}: LibraryHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What is a library?</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          <section>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Overview</h3>
            <p className="mt-1">
              A library is a folder on your computer. CertTrace stores your materials, cert files,
              and library settings there.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Why create a library</h3>
            <p className="mt-1">
              CertTrace uses a library to know where your data is saved. In a library you can:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Track materials and stock</li>
              <li>Attach certs and photos</li>
              <li>Print labels</li>
              <li>Search your records</li>
            </ul>
            <p className="mt-2">Your data stays on your computer. CertTrace does not upload it.</p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Choose a folder</h3>
            <p className="mt-1">
              You pick a folder on your computer. CertTrace creates a new library folder inside it.
            </p>
            <p className="mt-2">Pick a location that you back up and will not be deleted.</p>
            <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">Good options</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Documents or another folder you back up regularly</li>
              <li>iCloud Drive, Dropbox, or OneDrive if you use more than one computer</li>
            </ul>
            <p className="mt-3 font-medium text-slate-700 dark:text-slate-300">Avoid</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Temporary folders that may be cleared automatically</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Multiple libraries</h3>
            <p className="mt-1">
              You can create more than one library. Use separate libraries for different shops or
              projects.
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
