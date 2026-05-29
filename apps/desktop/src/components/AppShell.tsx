import type { ReactNode } from "react";
import { Button, cn, Separator } from "@certtrace/ui";
import { FolderPlus, Layers, Plus, Settings } from "lucide-react";
import type { ActiveLibraryPath } from "../hooks/useLibrarySession";

export type AppView = "materials" | "settings" | "library-settings";

interface LibraryOption {
  path: string;
  name: string;
}

interface AppShellProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  libraries: LibraryOption[];
  activeLibraryPath: ActiveLibraryPath;
  onLibraryChange: (path: ActiveLibraryPath) => void;
  onAddLibrary: () => void;
  onOpenLibrarySettings: () => void;
  children: ReactNode;
}

export function AppShell({
  activeView,
  onViewChange,
  libraries,
  activeLibraryPath,
  onLibraryChange,
  onAddLibrary,
  onOpenLibrarySettings,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">CertTrace</p>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Subtract Manufacturing
          </p>
        </div>

        <nav className="flex flex-col gap-1 px-2">
          <NavButton
            active={activeView === "materials"}
            icon={<Layers className="h-4 w-4" />}
            label="Materials"
            onClick={() => onViewChange("materials")}
          />
          <NavButton
            active={activeView === "settings"}
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            onClick={() => onViewChange("settings")}
          />
        </nav>

        <div className="mt-auto px-2 pb-4">
          <Separator className="mb-3" />
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Libraries
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <LibraryButton
              active={activeLibraryPath === "all"}
              label="All libraries"
              onClick={() => onLibraryChange("all")}
            />
            {libraries.map((library) => (
              <LibraryButton
                key={library.path}
                active={activeLibraryPath === library.path}
                label={library.name}
                subtitle={library.path}
                onClick={() => onLibraryChange(library.path)}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={onAddLibrary}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add library
            </Button>
            {activeLibraryPath && activeLibraryPath !== "all" ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={onOpenLibrarySettings}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Library settings
              </Button>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/70",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function LibraryButton({
  active,
  label,
  subtitle,
  onClick,
}: {
  active: boolean;
  label: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/70",
      )}
    >
      <span className="block truncate font-medium">{label}</span>
      {subtitle ? (
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
      ) : null}
    </button>
  );
}
