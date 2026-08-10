import { cn, Separator } from "@certtrace/ui";
import { Briefcase, Check, ChevronDown, Layers, Settings } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ActiveLibraryPath } from "../hooks/useLibrarySession";
import { AppLogo } from "./AppLogo";

export type AppView =
  | "materials"
  | "jobs"
  | "settings"
  | "library-settings"
  | "library-advanced-settings";

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
  onOpenLibrarySettings: () => void;
  children: ReactNode;
}

export function AppShell({
  activeView,
  onViewChange,
  libraries,
  activeLibraryPath,
  onLibraryChange,
  onOpenLibrarySettings,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex h-screen w-60 shrink-0 flex-col overflow-x-visible overflow-y-auto border-r border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <div className="shrink-0 px-3 py-4">
          <AppLogo variant="sidebar" />
        </div>

        <nav className="flex shrink-0 flex-col gap-1 px-2">
          <NavButton
            active={activeView === "materials"}
            icon={<Layers className="h-4 w-4" />}
            label="Materials"
            onClick={() => onViewChange("materials")}
          />
          <NavButton
            active={activeView === "jobs"}
            icon={<Briefcase className="h-4 w-4" />}
            label="Jobs"
            onClick={() => onViewChange("jobs")}
          />
          <NavButton
            active={activeView === "settings"}
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            onClick={() => onViewChange("settings")}
          />
        </nav>

        <div className="mt-auto shrink-0 px-2 pb-4">
          <Separator className="mb-3" />
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Library
          </p>
          <LibraryPicker
            libraries={libraries}
            activeLibraryPath={activeLibraryPath}
            onLibraryChange={onLibraryChange}
            onOpenLibrarySettings={onOpenLibrarySettings}
          />
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}

function LibraryPicker({
  libraries,
  activeLibraryPath,
  onLibraryChange,
  onOpenLibrarySettings,
}: {
  libraries: LibraryOption[];
  activeLibraryPath: ActiveLibraryPath;
  onLibraryChange: (path: ActiveLibraryPath) => void;
  onOpenLibrarySettings: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const multipleLibraries = libraries.length > 1;
  const activeLibrary =
    activeLibraryPath && activeLibraryPath !== "all"
      ? libraries.find((library) => library.path === activeLibraryPath)
      : undefined;
  const displayName =
    activeLibraryPath === "all"
      ? "All libraries"
      : (activeLibrary?.name ?? libraries[0]?.name ?? "Library");
  const canOpenLibrarySettings =
    activeLibraryPath !== "all" && Boolean(activeLibrary ?? libraries[0]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (libraries.length === 0) {
    return null;
  }

  function selectLibrary(path: ActiveLibraryPath) {
    onLibraryChange(path);
    setMenuOpen(false);
  }

  return (
    <div className="relative mt-2" ref={containerRef}>
      <div className="flex items-center gap-1 rounded-md bg-white px-2 py-2 shadow-sm dark:bg-slate-800">
        {multipleLibraries ? (
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/60"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="truncate text-sm font-medium">{displayName}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
                menuOpen && "rotate-180",
              )}
            />
          </button>
        ) : (
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
          </div>
        )}
        <button
          type="button"
          aria-label="Library settings"
          disabled={!canOpenLibrarySettings}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          onClick={onOpenLibrarySettings}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {multipleLibraries && menuOpen ? (
        <div
          role="listbox"
          aria-label="Select library"
          className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {libraries.map((library) => {
            const selected = activeLibraryPath === library.path;
            return (
              <button
                key={library.path}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800",
                  selected && "bg-slate-50 font-medium dark:bg-slate-800/70",
                )}
                onClick={() => selectLibrary(library.path)}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-700 dark:text-slate-200",
                    !selected && "invisible",
                  )}
                />
                <span className="truncate">{library.name}</span>
              </button>
            );
          })}
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            role="option"
            aria-selected={activeLibraryPath === "all"}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800",
              activeLibraryPath === "all" && "bg-slate-50 font-medium dark:bg-slate-800/70",
            )}
            onClick={() => selectLibrary("all")}
          >
            <Check
              className={cn(
                "h-4 w-4 shrink-0 text-slate-700 dark:text-slate-200",
                activeLibraryPath !== "all" && "invisible",
              )}
            />
            <span>All libraries</span>
          </button>
        </div>
      ) : null}
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
