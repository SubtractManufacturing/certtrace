import type {
  AppSettingsTheme,
  DefaultLibraryOnLaunch,
  RecentLibraryEntryV1,
  SizeUnit,
} from "@certtrace/types";
import type { Theme } from "@certtrace/ui";
import { Button, Label, Select, Switch, ThemeProvider } from "@certtrace/ui";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FolderOpen, Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { openAppDataFolder } from "../lib/app-data-client";
import { APP_VERSION } from "../lib/update-check";
import { LATEST_RELEASE_PAGE_URL } from "../lib/update-client";
import { ErrorBanner } from "./ErrorBanner";
import { RemoveLibraryDialog } from "./RemoveLibraryDialog";
import { SkyThemeToggle } from "./SkyThemeToggle";

interface SettingsViewProps {
  theme: AppSettingsTheme;
  resolvedTheme: Theme;
  checkForUpdates: boolean;
  includeArchivedMaterialsInSearch: boolean;
  defaultUnit: SizeUnit;
  defaultLibraryOnLaunch: DefaultLibraryOnLaunch;
  recentLibraries: RecentLibraryEntryV1[];
  checkingForUpdates: boolean;
  installingUpdate: boolean;
  updateAvailable: boolean;
  canInstallInApp: boolean;
  updateError: string | null;
  hasCheckedForUpdates: boolean;
  removingLibrary?: boolean;
  onThemeChange: (theme: AppSettingsTheme) => void;
  onCheckForUpdatesChange: (value: boolean) => void;
  onIncludeArchivedMaterialsInSearchChange: (value: boolean) => void;
  onDefaultUnitChange: (value: SizeUnit) => void;
  onDefaultLibraryChange: (value: DefaultLibraryOnLaunch) => void;
  onAddLibrary: () => void;
  onCreateLibrary: () => void;
  onRemoveLibrary: (path: string, deleteFolder: boolean) => Promise<void>;
  onOpenLibrarySettings: (path: string) => void;
  onCheckForUpdatesNow: () => void;
  onInstallUpdate: () => void;
}

export function SettingsView({
  theme,
  resolvedTheme,
  checkForUpdates,
  includeArchivedMaterialsInSearch,
  defaultUnit,
  defaultLibraryOnLaunch,
  recentLibraries,
  checkingForUpdates,
  installingUpdate,
  updateAvailable,
  canInstallInApp,
  updateError,
  hasCheckedForUpdates,
  removingLibrary = false,
  onThemeChange,
  onCheckForUpdatesChange,
  onIncludeArchivedMaterialsInSearchChange,
  onDefaultUnitChange,
  onDefaultLibraryChange,
  onAddLibrary,
  onCreateLibrary,
  onRemoveLibrary,
  onOpenLibrarySettings,
  onCheckForUpdatesNow,
  onInstallUpdate,
}: SettingsViewProps) {
  const [libraryToRemove, setLibraryToRemove] = useState<RecentLibraryEntryV1 | null>(null);
  const [appDataError, setAppDataError] = useState<string | null>(null);
  const [removeLibraryError, setRemoveLibraryError] = useState<string | null>(null);

  async function handleOpenAppDataFolder() {
    setAppDataError(null);
    try {
      await openAppDataFolder();
    } catch (err) {
      setAppDataError(err instanceof Error ? err.message : String(err));
    }
  }

  const launchOptions = recentLibraries;
  const useSystemTheme = theme === "system";

  return (
    <>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-auto px-6 py-6">
        <header>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Appearance</h2>
            <ThemeProvider
              theme={resolvedTheme}
              onThemeChange={(next) => {
                if (!useSystemTheme) {
                  onThemeChange(next);
                }
              }}
            >
              <SkyThemeToggle disabled={useSystemTheme} className="h-[25px] w-[47px]" />
            </ThemeProvider>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:focus:ring-slate-500"
              checked={useSystemTheme}
              onChange={(event) => {
                onThemeChange(event.target.checked ? "system" : resolvedTheme);
              }}
            />
            Use system theme
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Libraries</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add libraries here and choose which one opens automatically when CertTrace starts.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onAddLibrary}>
                <Plus className="mr-2 h-4 w-4" />
                Add library
              </Button>
              <Button type="button" variant="outline" onClick={onCreateLibrary}>
                Create library
              </Button>
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Label className="shrink-0 font-normal text-slate-600 dark:text-slate-400">
                Open on launch
              </Label>
              <Select
                className="w-auto min-w-[11rem]"
                value={defaultLibraryOnLaunch ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  onDefaultLibraryChange(value === "" ? null : (value as DefaultLibraryOnLaunch));
                }}
              >
                <option value="">Recent library</option>
                {launchOptions.length > 1 ? <option value="all">All libraries</option> : null}
                {launchOptions.map((entry) => (
                  <option key={entry.path} value={entry.path}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {recentLibraries.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {recentLibraries.map((entry) => (
                <li
                  key={entry.path}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.name}</p>
                    <p className="truncate text-xs text-slate-500">{entry.path}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Library settings for ${entry.name}`}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      onClick={() => onOpenLibrarySettings(entry.path)}
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={`Remove ${entry.name}`}
                      aria-label={`Remove ${entry.name}`}
                      className="rounded-md p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      onClick={() => setLibraryToRemove(entry)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No libraries added yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Units</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Default across app, some libraries may impose their own unit defaults
          </p>
          <div className="mt-4 max-w-xs">
            <Label htmlFor="default-unit">Default unit</Label>
            <Select
              id="default-unit"
              className="mt-1"
              value={defaultUnit}
              onChange={(event) => onDefaultUnitChange(event.target.value as SizeUnit)}
            >
              <option value="in">Inch</option>
              <option value="mm">Millimeter</option>
            </Select>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Updates</h2>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Label htmlFor="automatic-updates">Automatic updates</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Notify me in the app when a newer version is available.
              </p>
            </div>
            <Switch
              id="automatic-updates"
              className="shrink-0"
              checked={checkForUpdates}
              onCheckedChange={onCheckForUpdatesChange}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={updateAvailable && canInstallInApp ? "default" : "outline"}
              className={
                updateAvailable && canInstallInApp
                  ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              }
              disabled={checkingForUpdates || installingUpdate}
              onClick={() => {
                if (updateAvailable && canInstallInApp) {
                  onInstallUpdate();
                  return;
                }
                onCheckForUpdatesNow();
              }}
            >
              {checkingForUpdates
                ? "Checking…"
                : installingUpdate
                  ? "Installing…"
                  : updateAvailable && canInstallInApp
                    ? "Update now"
                    : "Look for updates"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              onClick={() => {
                void openUrl(LATEST_RELEASE_PAGE_URL);
              }}
            >
              Open in browser
            </Button>
            {updateError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{updateError}</p>
            ) : null}
            {hasCheckedForUpdates && !updateError && !checkingForUpdates && !updateAvailable ? (
              <p className="text-sm text-slate-500">You are on the latest version.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Search</h2>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="include-archived-search" className="text-sm font-medium">
                Include archived materials in search
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                When off, text search only matches active materials. When on, search can return
                archived materials even when browsing active stock. Use the Archived filter to
                browse archived materials without a search query.
              </p>
            </div>
            <Switch
              id="include-archived-search"
              className="shrink-0"
              checked={includeArchivedMaterialsInSearch}
              onCheckedChange={onIncludeArchivedMaterialsInSearchChange}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">About & privacy</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            CertTrace stores libraries on your filesystem and keeps app preferences locally. No
            material data is sent to the cloud unless you explicitly export or share files.
          </p>
          <p className="mt-2 text-sm text-slate-500">Version {APP_VERSION}</p>
          {appDataError ? (
            <div className="mt-4">
              <ErrorBanner message={appDataError} />
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void handleOpenAppDataFolder()}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Open app data folder
          </Button>
        </section>
      </div>

      <RemoveLibraryDialog
        entry={libraryToRemove}
        busy={removingLibrary}
        onClose={() => {
          setLibraryToRemove(null);
          setRemoveLibraryError(null);
        }}
        onConfirm={(path, deleteFolder) => {
          setRemoveLibraryError(null);
          void onRemoveLibrary(path, deleteFolder)
            .then(() => setLibraryToRemove(null))
            .catch((err) => {
              setRemoveLibraryError(err instanceof Error ? err.message : String(err));
            });
        }}
      />
      {removeLibraryError ? (
        <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-lg">
          <ErrorBanner message={removeLibraryError} />
        </div>
      ) : null}
    </>
  );
}
