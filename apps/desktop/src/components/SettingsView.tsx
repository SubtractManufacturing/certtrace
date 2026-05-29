import { appDataDir } from "@tauri-apps/api/path";
import type { AppSettingsTheme } from "@certtrace/types";
import { Button, Label, Select, Switch } from "@certtrace/ui";
import { FolderOpen } from "lucide-react";
import { openPathWithOpener } from "../lib/label-client";

interface SettingsViewProps {
  theme: AppSettingsTheme;
  checkForUpdates: boolean;
  onThemeChange: (theme: AppSettingsTheme) => void;
  onCheckForUpdatesChange: (value: boolean) => void;
}

export function SettingsView({
  theme,
  checkForUpdates,
  onThemeChange,
  onCheckForUpdatesChange,
}: SettingsViewProps) {
  async function openAppDataFolder() {
    await openPathWithOpener(await appDataDir());
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Appearance, updates, and app data.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <label className="mt-4 block space-y-1 text-sm">
          <Label>Theme</Label>
          <Select value={theme} onChange={(event) => onThemeChange(event.target.value as AppSettingsTheme)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Updates</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Check GitHub Releases for new versions when online.
            </p>
          </div>
          <Switch checked={checkForUpdates} onCheckedChange={onCheckForUpdatesChange} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">About & privacy</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          CertTrace stores libraries on your filesystem and keeps app preferences locally. No
          material data is sent to the cloud unless you explicitly export or share files.
        </p>
        <p className="mt-2 text-sm text-slate-500">Version 0.0.0</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void openAppDataFolder()}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open app data folder
        </Button>
      </section>
    </div>
  );
}
