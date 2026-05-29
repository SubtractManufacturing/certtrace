import { useState } from "react";
import { appDataDir } from "@tauri-apps/api/path";
import type { AppSettingsTheme, DefaultLibraryOnLaunch, RecentLibraryEntryV1 } from "@certtrace/types";
import { Button, Label, Select, Switch } from "@certtrace/ui";
import { FolderOpen, Plus } from "lucide-react";
import { APP_VERSION } from "../lib/update-check";
import { openPathWithOpener } from "../lib/label-client";
import { RemoveLibraryDialog } from "./RemoveLibraryDialog";

interface SettingsViewProps {
  theme: AppSettingsTheme;
  checkForUpdates: boolean;
  defaultLibraryOnLaunch: DefaultLibraryOnLaunch;
  recentLibraries: RecentLibraryEntryV1[];
  checkingForUpdates: boolean;
  updateAvailable: boolean;
  updateError: string | null;
  hasCheckedForUpdates: boolean;
  removingLibrary?: boolean;
  onThemeChange: (theme: AppSettingsTheme) => void;
  onCheckForUpdatesChange: (value: boolean) => void;
  onDefaultLibraryChange: (value: DefaultLibraryOnLaunch) => void;
  onAddLibrary: () => void;
  onCreateLibrary: () => void;
  onRemoveLibrary: (path: string, deleteFolder: boolean) => Promise<void>;
  onCheckForUpdatesNow: () => void;
  onUpdateNow: () => void;
}

export function SettingsView({
  theme,
  checkForUpdates,
  defaultLibraryOnLaunch,
  recentLibraries,
  checkingForUpdates,
  updateAvailable,
  updateError,
  hasCheckedForUpdates,
  removingLibrary = false,
  onThemeChange,
  onCheckForUpdatesChange,
  onDefaultLibraryChange,
  onAddLibrary,
  onCreateLibrary,
  onRemoveLibrary,
  onCheckForUpdatesNow,
  onUpdateNow,
}: SettingsViewProps) {
  const [libraryToRemove, setLibraryToRemove] = useState<RecentLibraryEntryV1 | null>(null);

  async function openAppDataFolder() {
    await openPathWithOpener(await appDataDir());
  }

  const launchOptions = recentLibraries;

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-auto px-6 py-6">
        <header>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Appearance, libraries, updates, and app data.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <label className="mt-4 block max-w-xs space-y-1 text-sm">
            <Label>Theme</Label>
            <Select value={theme} onChange={(event) => onThemeChange(event.target.value as AppSettingsTheme)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Libraries</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add libraries here and choose which one opens automatically when CertTrace starts.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onAddLibrary}>
              <Plus className="mr-2 h-4 w-4" />
              Add library
            </Button>
            <Button type="button" variant="outline" onClick={onCreateLibrary}>
              Create library
            </Button>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLibraryToRemove(entry)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No libraries added yet.</p>
          )}

          <label className="mt-4 block max-w-xs space-y-1 text-sm">
            <Label>Default library on launch</Label>
            <Select
              value={defaultLibraryOnLaunch ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onDefaultLibraryChange(value === "" ? null : (value as DefaultLibraryOnLaunch));
              }}
            >
              <option value="">Most recent library</option>
              {launchOptions.length > 1 ? <option value="all">All libraries</option> : null}
              {launchOptions.map((entry) => (
                <option key={entry.path} value={entry.path}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Updates</h2>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="automatic-updates">Automatic updates</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Notify me in the app when a newer version is available on GitHub.
              </p>
            </div>
            <Switch
              id="automatic-updates"
              checked={checkForUpdates}
              onCheckedChange={onCheckForUpdatesChange}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={updateAvailable ? "default" : "outline"}
              disabled={checkingForUpdates}
              onClick={() => (updateAvailable ? onUpdateNow() : void onCheckForUpdatesNow())}
            >
              {checkingForUpdates
                ? "Checking…"
                : updateAvailable
                  ? "Update now"
                  : "Look for updates"}
            </Button>
            {updateError ? <p className="text-sm text-red-600 dark:text-red-400">{updateError}</p> : null}
            {hasCheckedForUpdates && !updateError && !checkingForUpdates && !updateAvailable ? (
              <p className="text-sm text-slate-500">You are on the latest version.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">About & privacy</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            CertTrace stores libraries on your filesystem and keeps app preferences locally. No
            material data is sent to the cloud unless you explicitly export or share files.
          </p>
          <p className="mt-2 text-sm text-slate-500">Version {APP_VERSION}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void openAppDataFolder()}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open app data folder
          </Button>
        </section>
      </div>

      <RemoveLibraryDialog
        entry={libraryToRemove}
        busy={removingLibrary}
        onClose={() => setLibraryToRemove(null)}
        onConfirm={(path, deleteFolder) => {
          void onRemoveLibrary(path, deleteFolder)
            .then(() => setLibraryToRemove(null))
            .catch(() => undefined);
        }}
      />
    </>
  );
}
