import type { OpenLibraryResult } from "@certtrace/library-engine";
import { cn } from "@certtrace/ui";
import { ChevronRight, Wrench } from "lucide-react";

interface LibrarySettingsViewProps {
  library: OpenLibraryResult;
  onOpenAdvancedSettings: () => void;
}

export function LibrarySettingsView({
  library,
  onOpenAdvancedSettings,
}: LibrarySettingsViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-6">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold">Library settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {library.config.name}
        </p>
      </header>

      <div className="mt-6 min-h-0 flex-1 overflow-auto">
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
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
