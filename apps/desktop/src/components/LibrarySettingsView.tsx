import type { OpenLibraryResult } from "@certtrace/library-engine";
import { cn } from "@certtrace/ui";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";
import { LabelTemplatesEditor } from "./LabelTemplatesEditor";
import { MaterialTableColumnsEditor } from "./MaterialTableColumnsEditor";

interface LibrarySettingsViewProps {
  library: OpenLibraryResult;
  onOpenAdvancedSettings: () => void;
  onLibraryUpdated: (library: OpenLibraryResult) => void;
  onRefreshLibrary: () => Promise<void>;
}

export function LibrarySettingsView({
  library,
  onOpenAdvancedSettings,
  onLibraryUpdated,
  onRefreshLibrary,
}: LibrarySettingsViewProps) {
  const [columnsExpanded, setColumnsExpanded] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6">
        <header>
          <h1 className="text-2xl font-semibold">Library settings</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{library.config.name}</p>
        </header>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Material columns</h2>
              <button
                type="button"
                aria-expanded={columnsExpanded}
                aria-label={
                  columnsExpanded ? "Collapse material columns" : "Expand material columns"
                }
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => setColumnsExpanded((expanded) => !expanded)}
              >
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 ease-in-out",
                    columnsExpanded && "rotate-180",
                  )}
                />
              </button>
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-in-out",
                columnsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden" inert={!columnsExpanded ? true : undefined}>
                <div
                  className={cn(
                    "pt-4 transition-opacity duration-200 ease-in-out",
                    columnsExpanded ? "opacity-100" : "opacity-0",
                  )}
                >
                  <MaterialTableColumnsEditor
                    library={library}
                    onLibraryUpdated={onLibraryUpdated}
                    onRefreshLibrary={onRefreshLibrary}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Label Templates</h2>
              <button
                type="button"
                aria-expanded={labelsExpanded}
                aria-label={
                  labelsExpanded ? "Collapse Label Templates" : "Expand Label Templates"
                }
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => setLabelsExpanded((expanded) => !expanded)}
              >
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 ease-in-out",
                    labelsExpanded && "rotate-180",
                  )}
                />
              </button>
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-in-out",
                labelsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden" inert={!labelsExpanded ? true : undefined}>
                <div
                  className={cn(
                    "pt-4 transition-opacity duration-200 ease-in-out",
                    labelsExpanded ? "opacity-100" : "opacity-0",
                  )}
                >
                  <LabelTemplatesEditor
                    library={library}
                    onLibraryUpdated={onLibraryUpdated}
                    onRefreshLibrary={onRefreshLibrary}
                  />
                </div>
              </div>
            </div>
          </section>

          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left",
              "transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60",
            )}
            onClick={onOpenAdvancedSettings}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Wrench className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Advanced settings</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                Material schema, ID strategies, and word lists.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
