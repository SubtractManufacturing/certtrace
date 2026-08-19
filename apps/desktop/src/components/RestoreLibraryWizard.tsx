import { libraryRestoreDestination } from "@certtrace/library-engine";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@certtrace/ui";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  inspectLibraryBackup,
  pickLibraryBackupZip,
  pickParentFolder,
} from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";

interface RestoreLibraryWizardProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onRestore: (zipPath: string, parentDir: string) => Promise<void>;
}

const STEP_NAMES = ["ZIP", "Folder", "Restore"] as const;
const FINAL_STEP = STEP_NAMES.length - 1;

export function RestoreLibraryWizard({
  open,
  busy = false,
  onClose,
  onRestore,
}: RestoreLibraryWizardProps) {
  const [step, setStep] = useState(0);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [libraryName, setLibraryName] = useState<string | null>(null);
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickingZip, setPickingZip] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);

  function reset() {
    setStep(0);
    setZipPath(null);
    setLibraryName(null);
    setParentDir(null);
    setError(null);
  }

  async function handlePickZip() {
    setPickingZip(true);
    setError(null);
    try {
      const picked = await pickLibraryBackupZip();
      if (!picked) {
        return;
      }
      const inspected = await inspectLibraryBackup(picked);
      setZipPath(picked);
      setLibraryName(inspected.name);
    } catch (err) {
      console.error(err);
      setZipPath(null);
      setLibraryName(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickingZip(false);
    }
  }

  async function handlePickFolder() {
    setPickingFolder(true);
    setError(null);
    try {
      const picked = await pickParentFolder("Choose where to restore the library");
      if (picked) {
        setParentDir(picked);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickingFolder(false);
    }
  }

  async function handleRestore() {
    setError(null);
    if (!zipPath || !libraryName) {
      setError("Choose a library backup ZIP.");
      return;
    }
    if (!parentDir) {
      setError("Choose a folder for the restored library.");
      return;
    }

    try {
      await onRestore(zipPath, parentDir);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
      onClose();
    }
  }

  const dest = libraryName && parentDir ? libraryRestoreDestination(parentDir, libraryName) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-h-96 max-w-lg flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_NAMES.length} — {STEP_NAMES[step]}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          {step === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose a library backup ZIP. CertTrace will restore it as a new folder.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || pickingZip}
                onClick={() => void handlePickZip()}
              >
                {pickingZip ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Choose ZIP
              </Button>
              {libraryName ? (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-medium text-slate-900 dark:text-slate-100">Library:</span>{" "}
                  {libraryName}
                </p>
              ) : null}
              {zipPath ? (
                <p className="truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                  {zipPath}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                CertTrace will create a folder named after the library inside the location you
                choose.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || pickingFolder}
                onClick={() => void handlePickFolder()}
              >
                {pickingFolder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Choose folder
              </Button>
              {parentDir ? (
                <p className="truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                  {parentDir}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Library:</span>{" "}
                {libraryName ?? "Unknown"}
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Restore to:</span>{" "}
                {dest ?? "Not selected"}
              </p>
            </div>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}

          <DialogFooter className="mt-auto flex-row justify-between pt-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < FINAL_STEP ? (
              <Button
                type="button"
                disabled={busy || pickingZip || pickingFolder || (step === 0 && !zipPath)}
                onClick={() => setStep((current) => current + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void handleRestore()}>
                Restore library
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
