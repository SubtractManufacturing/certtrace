import { useMemo, useState } from "react";
import type { CreateLibraryOptions } from "@certtrace/library-engine";
import { defaultNamingRulesV1, defaultWordListsV1 } from "@certtrace/types";
import type { NamingStrategyV1 } from "@certtrace/types";
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
  Select,
} from "@certtrace/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pickParentFolder } from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import { IdTemplateBuilder } from "./IdTemplateBuilder";

interface CreateLibraryWizardProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (parentDir: string, options: CreateLibraryOptions) => Promise<void>;
}

const LABEL_TEMPLATES = [{ id: "standard-qr", label: "Standard QR label" }] as const;
const STEP_NAMES = ["Name", "Folder", "ID strategy", "Label template", "Create"] as const;

export function CreateLibraryWizard({ open, busy = false, onClose, onCreate }: CreateLibraryWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Main Shop Materials");
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState(
    defaultNamingRulesV1.activeStrategyId,
  );
  const [customStrategy, setCustomStrategy] = useState<NamingStrategyV1 | null>(null);
  const [labelTemplate, setLabelTemplate] = useState("standard-qr");
  const [error, setError] = useState<string | null>(null);

  const strategies = useMemo(() => {
    if (customStrategy) {
      return [...defaultNamingRulesV1.strategies, customStrategy];
    }
    return defaultNamingRulesV1.strategies;
  }, [customStrategy]);

  const activeStrategy = strategies.find((entry) => entry.id === selectedStrategyId);

  async function handlePickFolder() {
    const picked = await pickParentFolder("Choose where to create the library");
    if (picked) {
      setParentDir(picked);
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
    if (!activeStrategy) {
      setError("Choose an ID strategy.");
      return;
    }

    const namingRules = customStrategy
      ? {
          ...defaultNamingRulesV1,
          strategies: [
            ...defaultNamingRulesV1.strategies.filter((entry) => entry.id !== customStrategy.id),
            customStrategy,
          ],
          activeStrategyId: customStrategy.id,
        }
      : {
          ...defaultNamingRulesV1,
          activeStrategyId: selectedStrategyId,
        };

    try {
      await onCreate(parentDir, {
        name: trimmed,
        idStrategy: namingRules.activeStrategyId,
        labelTemplate,
        namingRules,
        wordLists: defaultWordListsV1,
      });
      setStep(0);
      setParentDir(null);
      setCustomStrategy(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function startCustomStrategy() {
    const strategy: NamingStrategyV1 = {
      id: "custom",
      label: "Custom strategy",
      template: "{material}-{word:animals}-{number}",
      numberPad: 3,
      case: "lower",
    };
    setCustomStrategy(strategy);
    setSelectedStrategyId(strategy.id);
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create library</DialogTitle>
          <DialogDescription>
            Step {step + 1} of 5 — {STEP_NAMES[step]}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
              <Button type="button" variant="outline" onClick={() => void handlePickFolder()}>
                Choose folder
              </Button>
              {parentDir ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                  {parentDir}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <label className="block space-y-1 text-sm">
                <Label>Preset strategy</Label>
                <Select
                  value={selectedStrategyId}
                  onChange={(event) => setSelectedStrategyId(event.target.value)}
                >
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.label}
                    </option>
                  ))}
                </Select>
              </label>
              <Button type="button" variant="outline" onClick={startCustomStrategy}>
                Build custom strategy
              </Button>
              {customStrategy && selectedStrategyId === customStrategy.id ? (
                <IdTemplateBuilder
                  strategy={customStrategy}
                  onChange={(strategy) => {
                    setCustomStrategy(strategy);
                    setSelectedStrategyId(strategy.id);
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <label className="block space-y-1 text-sm">
              <Label>Label template</Label>
              <Select value={labelTemplate} onChange={(event) => setLabelTemplate(event.target.value)}>
                {LABEL_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          {step === 4 ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Name:</span>{" "}
                {name.trim()}
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">Folder:</span>{" "}
                {parentDir ?? "Not selected"}
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  ID strategy:
                </span>{" "}
                {activeStrategy?.label}
              </p>
              <p>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Label template:
                </span>{" "}
                {LABEL_TEMPLATES.find((entry) => entry.id === labelTemplate)?.label}
              </p>
            </div>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}

          <DialogFooter className="flex-row justify-between pt-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < 4 ? (
              <Button type="button" disabled={busy} onClick={() => setStep((current) => current + 1)}>
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
