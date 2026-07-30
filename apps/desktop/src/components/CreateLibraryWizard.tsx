import type { CreateLibraryOptions } from "@certtrace/library-engine";
import { defaultNamingRulesV1, defaultWordListsV1 } from "@certtrace/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@certtrace/ui";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { pickParentFolder } from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";

interface CreateLibraryWizardProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (parentDir: string, options: CreateLibraryOptions) => Promise<void>;
}

const STEP_NAMES = ["Name", "Folder", "Create"] as const;
const FINAL_STEP = STEP_NAMES.length - 1;

export function CreateLibraryWizard({
  open,
  busy = false,
  onClose,
  onCreate,
}: CreateLibraryWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Shop Materials");
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);

  async function handlePickFolder() {
    setPickingFolder(true);
    setError(null);
    try {
      const picked = await pickParentFolder("Choose where to create the library");
      if (picked) {
        setParentDir(picked);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickingFolder(false);
    }
  }

  async function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a library name.");
      return;
    }
    if (!parentDir) {
      setError("Choose a folder for the library.");
      return;
    }

    try {
      await onCreate(parentDir, {
        name: trimmed,
        idStrategy: defaultNamingRulesV1.activeStrategyId,
        labelTemplate: "standard-qr",
        namingRules: defaultNamingRulesV1,
        wordLists: defaultWordListsV1,
      });
      setStep(0);
      setParentDir(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(0);
      setError(null);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-h-96 max-w-lg flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create library</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_NAMES.length} — {STEP_NAMES[step]}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          {step === 0 ? (
            <label className="block space-y-1 text-sm">
              <Label>Library name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                CertTrace will create a folder named after your library inside the location you
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
              {pickingFolder || parentDir ? (
                <p className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                  {pickingFolder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Applying folder selection...</span>
                    </>
                  ) : (
                    parentDir
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Name:</span>{" "}
                {name.trim()}
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Folder:</span>{" "}
                {parentDir ?? "Not selected"}
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
                disabled={busy || (step === 1 && pickingFolder)}
                onClick={() => setStep((current) => current + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void handleCreate()}>
                Create library
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
