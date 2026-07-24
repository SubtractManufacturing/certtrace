import type { RecentLibraryEntryV1 } from "@certtrace/types";
import { Button } from "@certtrace/ui";
import { useEffect, useState } from "react";
import { forgetRecentLibrary, loadAppSettings } from "../lib/app-settings-client";
import { pickParentFolder } from "../lib/library-client";
import { ErrorBanner } from "./ErrorBanner";
import { SkyThemeToggle } from "./SkyThemeToggle";

interface WelcomeViewProps {
  busy?: boolean;
  onOpenLibrary: (path: string) => Promise<void>;
  onStartCreateLibrary: () => void;
}

export function WelcomeView({
  busy = false,
  onOpenLibrary,
  onStartCreateLibrary,
}: WelcomeViewProps) {
  const [recentLibraries, setRecentLibraries] = useState<RecentLibraryEntryV1[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(true);

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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-slate-900 transition-colors duration-500 ease-in-out dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute top-4 right-4 z-10 sm:top-5 sm:right-5">
        <SkyThemeToggle />
      </div>

      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-colors duration-500 ease-in-out dark:border-slate-800 dark:bg-slate-900">
        {/* Keep logo chrome size identical across themes so the card doesn't reflow. */}
        <h1 className="mx-auto flex w-fit justify-center rounded-md px-4 py-3 dark:bg-white">
          <img
            src="/logo-horizontal.svg"
            alt="CertTrace"
            className="h-14 w-auto max-w-full sm:h-16"
          />
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 transition-colors duration-500 ease-in-out dark:text-slate-400">
          Open an existing library folder, or create a new one in the location you choose. CertTrace
          creates a folder named after your library and writes a README inside.
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
            className="h-11 w-full max-w-sm bg-sky-500 text-white shadow-sm transition-colors duration-500 ease-in-out hover:bg-sky-400 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
            onClick={onStartCreateLibrary}
          >
            Create library
          </Button>
          <button
            type="button"
            disabled={busy}
            className="h-8 w-full max-w-sm text-xs font-medium text-slate-500 transition-colors duration-500 ease-in-out hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-500"
            onClick={() => void handleOpenLibrary()}
          >
            Open library
          </button>
        </div>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
