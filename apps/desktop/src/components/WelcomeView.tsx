import type { RecentLibraryEntryV1 } from "@certtrace/types";
import { Button } from "@certtrace/ui";
import { CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import { forgetRecentLibrary, loadAppSettings } from "../lib/app-settings-client";
import { pickParentFolder } from "../lib/library-client";
import { AppLogo } from "./AppLogo";
import { ErrorBanner } from "./ErrorBanner";
import { LibraryHelpDialog } from "./LibraryHelpDialog";
import { SkyThemeToggle } from "./SkyThemeToggle";

interface WelcomeViewProps {
  busy?: boolean;
  onOpenLibrary: (path: string) => Promise<void>;
  onStartCreateLibrary: () => void;
  onStartRestoreLibrary: () => void;
}

export function WelcomeView({
  busy = false,
  onOpenLibrary,
  onStartCreateLibrary,
  onStartRestoreLibrary,
}: WelcomeViewProps) {
  const [recentLibraries, setRecentLibraries] = useState<RecentLibraryEntryV1[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    void loadAppSettings()
      .then((settings) => setRecentLibraries(settings.recentLibraries))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoadingRecent(false));
  }, []);

  async function handleOpenLibrary() {
    setError(null);
    try {
      const root = await pickParentFolder("Open CertTrace library folder");
      if (!root) {
        return;
      }
      await onOpenLibrary(root);
      setRecentLibraries((await loadAppSettings()).recentLibraries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenRecent(entry: RecentLibraryEntryV1) {
    setError(null);
    try {
      await onOpenLibrary(entry.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemoveRecent(path: string) {
    try {
      const settings = await forgetRecentLibrary(path);
      setRecentLibraries(settings.recentLibraries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-slate-900 transition-[background-color] duration-500 ease-in-out dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute top-4 right-4 z-10 sm:top-5 sm:right-5">
        <SkyThemeToggle />
      </div>

      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-[background-color,border-color] duration-500 ease-in-out dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          aria-label="What is a library?"
          className="absolute top-4 right-4 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-slate-500"
          onClick={() => setHelpOpen(true)}
        >
          <CircleHelp className="h-5 w-5" aria-hidden />
        </button>
        <h1>
          <AppLogo variant="welcome" />
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Open an existing library folder, or create a new one in the location you choose.
        </p>

        {!loadingRecent && recentLibraries.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Recent libraries
            </h2>
            <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {recentLibraries.map((entry) => (
                <li
                  key={entry.path}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleOpenRecent(entry)}
                    className="min-w-0 flex-1 text-left hover:text-slate-900 disabled:opacity-50 dark:hover:text-slate-100"
                  >
                    <span className="block truncate font-medium">{entry.name}</span>
                    <span className="block truncate text-xs text-slate-500">{entry.path}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRemoveRecent(entry.path)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            type="button"
            disabled={busy}
            className="h-11 w-full max-w-sm bg-sky-500 text-white shadow-sm transition-[background-color,color] duration-500 ease-in-out hover:bg-sky-400 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
            onClick={onStartCreateLibrary}
          >
            Create library
          </Button>
          <button
            type="button"
            disabled={busy}
            className="h-8 w-full max-w-sm text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-500"
            onClick={() => void handleOpenLibrary()}
          >
            Open library
          </button>
          <button
            type="button"
            disabled={busy}
            className="h-8 w-full max-w-sm text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-500"
            onClick={onStartRestoreLibrary}
          >
            Restore from backup
          </button>
        </div>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        ) : null}
      </div>

      <LibraryHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </main>
  );
}
