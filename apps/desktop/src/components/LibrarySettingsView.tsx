import type { OpenLibraryResult } from "@certtrace/library-engine";
import { type LibraryDefaultUnit, resolveSizeUnit, type SizeUnit } from "@certtrace/types";
import { Button, cn, Label, Select } from "@certtrace/ui";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { updateLibraryConfigPartial } from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import { LabelTemplatesEditor } from "./LabelTemplatesEditor";
import { MaterialTableColumnsEditor } from "./MaterialTableColumnsEditor";
import { ShapesEditor } from "./ShapesEditor";

interface LibrarySettingsViewProps {
  library: OpenLibraryResult;
  installDefaultUnit?: SizeUnit;
  expandLabelTemplates?: boolean;
  onOpenAdvancedSettings: () => void;
  onLibraryUpdated: (library: OpenLibraryResult) => void;
  onRefreshLibrary: () => Promise<void>;
  onBackupLibrary: () => void;
}

function CollapsibleSettingsSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform duration-200 ease-in-out",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!expanded ? true : undefined}>
          <div
            className={cn(
              "pt-4 transition-opacity duration-200 ease-in-out",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function LibrarySettingsView({
  library,
  installDefaultUnit = "in",
  expandLabelTemplates = false,
  onOpenAdvancedSettings,
  onLibraryUpdated,
  onRefreshLibrary,
  onBackupLibrary,
}: LibrarySettingsViewProps) {
  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const [columnsExpanded, setColumnsExpanded] = useState(false);
  const [shapesExpanded, setShapesExpanded] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(expandLabelTemplates);
  const [unitError, setUnitError] = useState<string | null>(null);

  useEffect(() => {
    if (expandLabelTemplates) {
      setLabelsExpanded(true);
    }
  }, [expandLabelTemplates]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Library settings</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{library.config.name}</p>
          </div>
          <Button type="button" variant="outline" onClick={onBackupLibrary}>
            Backup library
          </Button>
        </header>

        <div className="space-y-4">
          <CollapsibleSettingsSection
            title="Units"
            expanded={unitsExpanded}
            onToggle={() => setUnitsExpanded((expanded) => !expanded)}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Default for new Size in this library. App default follows Global settings.
            </p>
            <div className="mt-4 max-w-xs">
              <Label htmlFor="library-default-unit">Default unit</Label>
              <Select
                id="library-default-unit"
                className="mt-1"
                value={library.config.defaultUnit}
                onChange={(event) => {
                  const defaultUnit = event.target.value as LibraryDefaultUnit;
                  setUnitError(null);
                  void updateLibraryConfigPartial(library, { defaultUnit })
                    .then(onLibraryUpdated)
                    .catch((error: unknown) => {
                      setUnitError(error instanceof Error ? error.message : String(error));
                    });
                }}
              >
                <option value="app">App default</option>
                <option value="in">Inch</option>
                <option value="mm">Millimeter</option>
              </Select>
              {unitError ? (
                <div className="mt-2">
                  <ErrorBanner message={unitError} />
                </div>
              ) : null}
            </div>
          </CollapsibleSettingsSection>

          <CollapsibleSettingsSection
            title="Material columns"
            expanded={columnsExpanded}
            onToggle={() => setColumnsExpanded((expanded) => !expanded)}
          >
            <MaterialTableColumnsEditor
              library={library}
              onLibraryUpdated={onLibraryUpdated}
              onRefreshLibrary={onRefreshLibrary}
            />
          </CollapsibleSettingsSection>

          <CollapsibleSettingsSection
            title="Shapes"
            expanded={shapesExpanded}
            onToggle={() => setShapesExpanded((expanded) => !expanded)}
          >
            <ShapesEditor
              library={library}
              onLibraryUpdated={onLibraryUpdated}
              onRefreshLibrary={onRefreshLibrary}
            />
          </CollapsibleSettingsSection>

          <CollapsibleSettingsSection
            title="Label Templates"
            expanded={labelsExpanded}
            onToggle={() => setLabelsExpanded((expanded) => !expanded)}
          >
            <LabelTemplatesEditor
              library={library}
              defaultDisplayUnit={resolveSizeUnit(library.config.defaultUnit, installDefaultUnit)}
              onLibraryUpdated={onLibraryUpdated}
              onRefreshLibrary={onRefreshLibrary}
            />
          </CollapsibleSettingsSection>

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
