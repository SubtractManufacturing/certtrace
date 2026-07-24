import type { DefaultLibraryOnLaunch } from "@certtrace/types";
import { ThemeProvider } from "@certtrace/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type AppView } from "./components/AppShell";
import { CreateLibraryWizard } from "./components/CreateLibraryWizard";
import { ErrorBanner } from "./components/ErrorBanner";
import { LibrarySettingsView } from "./components/LibrarySettingsView";
import { MaterialsWorkspace } from "./components/MaterialsWorkspace";
import { SettingsView } from "./components/SettingsView";
import { UpdateAvailableDialog } from "./components/UpdateAvailableBanner";
import { WelcomeView } from "./components/WelcomeView";
import { useAppSettings } from "./hooks/useAppSettings";
import { type ActiveLibraryPath, useLibrarySession } from "./hooks/useLibrarySession";
import { useSearchIndex } from "./hooks/useSearchIndex";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import { forgetRecentLibrary } from "./lib/app-settings-client";
import { deleteLibraryFolder, pickParentFolder } from "./lib/library-client";
import { onLibraryFsChanged, syncLibraryWatch } from "./lib/library-watch";

async function bootstrapLibraries(
  defaultLibraryOnLaunch: DefaultLibraryOnLaunch,
  recentLibraries: { path: string }[],
  openLibrary: (path: string) => Promise<unknown>,
  setActiveLibraryPath: (path: string | "all" | null) => void,
) {
  if (defaultLibraryOnLaunch === "all") {
    const paths = recentLibraries.map((entry) => entry.path);
    if (paths.length === 0) {
      return;
    }
    for (const path of paths) {
      await openLibrary(path);
    }
    if (paths.length > 1) {
      setActiveLibraryPath("all");
    }
    return;
  }

  const targetPath = defaultLibraryOnLaunch ?? recentLibraries[0]?.path;

  if (!targetPath) {
    return;
  }

  await openLibrary(targetPath);
}

function App() {
  const {
    settings,
    resolvedTheme,
    loading: settingsLoading,
    error: settingsError,
    setTheme,
    updateSettings,
    refresh: refreshSettings,
  } = useAppSettings();
  const session = useLibrarySession();
  const [activeView, setActiveView] = useState<AppView>("materials");
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [removingLibrary, setRemovingLibrary] = useState(false);
  const bootstrapAttempted = useRef(false);

  const updateCheck = useUpdateCheck({
    enabled: Boolean(settings?.checkForUpdates),
    autoCheck: Boolean(settings?.checkForUpdates),
  });

  const recentLibraries = settings?.recentLibraries ?? [];

  const librariesForSettings = useMemo(() => {
    const byPath = new Map(recentLibraries.map((entry) => [entry.path, entry]));
    for (const [path, library] of session.sessionLibraries) {
      if (!byPath.has(path)) {
        byPath.set(path, {
          path,
          name: library.config.name,
          lastOpenedAt: new Date().toISOString(),
        });
      }
    }
    return [...byPath.values()];
  }, [recentLibraries, session.sessionLibraries]);

  const {
    indexedMaterials,
    filterMaterials,
    loading: materialsLoading,
    error: materialsError,
    refreshLibraryMaterials,
  } = useSearchIndex({
    sessionLibraries: session.sessionLibraries,
    activeLibraryPath: session.activeLibraryPath,
    recentLibraries,
  });

  const libraryPickerOptions = useMemo(
    () => librariesForSettings.map((entry) => ({ path: entry.path, name: entry.name })),
    [librariesForSettings],
  );

  useEffect(() => {
    if (settingsLoading || bootstrapAttempted.current) {
      return;
    }

    bootstrapAttempted.current = true;

    void (async () => {
      try {
        await bootstrapLibraries(
          settings?.defaultLibraryOnLaunch ?? null,
          recentLibraries,
          session.openLibrary,
          session.setActiveLibraryPath,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [settingsLoading, settings?.defaultLibraryOnLaunch, recentLibraries, session]);

  useEffect(() => {
    if (activeView === "settings") {
      void refreshSettings();
    }
  }, [activeView, refreshSettings]);

  useEffect(() => {
    if (!session.hasSession || session.activeLibraryPath) {
      return;
    }
    session.setActiveLibraryPath(
      session.sessionLibraries.size > 1 ? "all" : ([...session.sessionLibraries.keys()][0] ?? null),
    );
  }, [
    session.hasSession,
    session.activeLibraryPath,
    session.sessionLibraries,
    session.setActiveLibraryPath,
  ]);

  useEffect(() => {
    const roots = [...session.sessionLibraries.keys()];
    if (roots.length === 0) {
      return;
    }

    void syncLibraryWatch(roots);

    let unlisten: (() => void) | undefined;
    let mounted = true;

    void (async () => {
      const dispose = await onLibraryFsChanged((event) => {
        const root = event.root;
        if (session.sessionLibraries.has(root)) {
          void refreshLibraryMaterials(root);
          void session.refreshLibrary(root);
        }
      });
      if (mounted) {
        unlisten = dispose;
      } else {
        dispose();
      }
    })();

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [refreshLibraryMaterials, session.refreshLibrary, session.sessionLibraries]);

  async function handleOpenLibrary(path: string) {
    setBusy(true);
    setError(null);
    try {
      await session.openLibrary(path);
      await refreshSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLibraryFromSettings() {
    setError(null);
    try {
      const root = await pickParentFolder("Open CertTrace library folder");
      if (!root) {
        return;
      }
      await handleOpenLibrary(root);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleLibraryChange(path: ActiveLibraryPath) {
    if (path === "all") {
      session.setActiveLibraryPath("all");
      return;
    }
    if (!path) {
      return;
    }

    setError(null);
    try {
      if (!session.sessionLibraries.has(path)) {
        await session.openLibrary(path);
      } else {
        session.setActiveLibraryPath(path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemoveLibrary(path: string, deleteFolder: boolean) {
    setRemovingLibrary(true);
    setError(null);
    try {
      if (deleteFolder) {
        await deleteLibraryFolder(path);
      }
      await forgetRecentLibrary(path);
      session.removeLibraryFromSession(path);
      if (settings?.defaultLibraryOnLaunch === path) {
        await updateSettings({ defaultLibraryOnLaunch: null });
      }
      await refreshSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setRemovingLibrary(false);
    }
  }

  async function handleCreateLibrary(
    parentDir: string,
    options: Parameters<typeof session.createLibrary>[1],
  ) {
    setBusy(true);
    setError(null);
    try {
      await session.createLibrary(parentDir, options);
      await refreshSettings();
      setActiveView("materials");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (settingsLoading || bootstrapping) {
    return (
      <ThemeProvider theme={resolvedTheme}>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          Loading library…
        </main>
      </ThemeProvider>
    );
  }

  if (!session.hasSession) {
    return (
      <ThemeProvider theme={resolvedTheme} onThemeChange={(theme) => void setTheme(theme)}>
        <WelcomeView
          busy={busy}
          onOpenLibrary={handleOpenLibrary}
          onStartCreateLibrary={() => setShowCreateWizard(true)}
        />
        <CreateLibraryWizard
          open={showCreateWizard}
          busy={busy}
          onClose={() => setShowCreateWizard(false)}
          onCreate={async (parentDir, options) => {
            await handleCreateLibrary(parentDir, options);
            setShowCreateWizard(false);
          }}
        />
        {error || settingsError ? (
          <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-lg">
            <ErrorBanner message={error ?? settingsError ?? ""} />
          </div>
        ) : null}
      </ThemeProvider>
    );
  }

  const activeLibrary =
    session.activeLibraryPath && session.activeLibraryPath !== "all"
      ? session.sessionLibraries.get(session.activeLibraryPath)
      : undefined;

  const settingsLibraryForMenu =
    activeLibrary ??
    (libraryPickerOptions.length === 1
      ? session.sessionLibraries.get(libraryPickerOptions[0]!.path)
      : undefined);

  return (
    <ThemeProvider theme={resolvedTheme}>
      <AppShell
        activeView={activeView}
        onViewChange={setActiveView}
        libraries={libraryPickerOptions}
        activeLibraryPath={session.activeLibraryPath}
        onLibraryChange={(path) => void handleLibraryChange(path)}
        onOpenLibrarySettings={() => setActiveView("library-settings")}
      >
        {activeView === "materials" ? (
          <MaterialsWorkspace
            sessionLibraries={session.sessionLibraries}
            activeLibraryPath={session.activeLibraryPath}
            materials={indexedMaterials}
            loading={materialsLoading}
            error={materialsError ?? error}
            onRefreshLibrary={refreshLibraryMaterials}
            filterMaterials={filterMaterials}
            onEnsureLibrary={(path) => session.openLibrary(path)}
          />
        ) : null}

        {activeView === "settings" && settings ? (
          <SettingsView
            theme={settings.theme}
            checkForUpdates={settings.checkForUpdates}
            defaultLibraryOnLaunch={settings.defaultLibraryOnLaunch}
            recentLibraries={librariesForSettings}
            checkingForUpdates={updateCheck.checking}
            installingUpdate={updateCheck.installing}
            updateAvailable={Boolean(updateCheck.updateInfo)}
            canInstallInApp={updateCheck.canInstallInApp}
            updateError={updateCheck.error}
            hasCheckedForUpdates={updateCheck.hasChecked}
            removingLibrary={removingLibrary}
            onThemeChange={(theme) => void setTheme(theme)}
            onCheckForUpdatesChange={(value) => void updateSettings({ checkForUpdates: value })}
            onDefaultLibraryChange={(value) =>
              void updateSettings({ defaultLibraryOnLaunch: value })
            }
            onAddLibrary={() => void handleAddLibraryFromSettings()}
            onCreateLibrary={() => setShowCreateWizard(true)}
            onRemoveLibrary={(path, deleteFolder) => handleRemoveLibrary(path, deleteFolder)}
            onCheckForUpdatesNow={() => void updateCheck.checkNow()}
            onInstallUpdate={() => void updateCheck.installNow()}
          />
        ) : null}

        {activeView === "library-settings" && settingsLibraryForMenu ? (
          <LibrarySettingsView
            library={settingsLibraryForMenu}
            onLibraryUpdated={(library) => session.updateLibraryInSession(library)}
          />
        ) : null}
      </AppShell>

      <CreateLibraryWizard
        open={showCreateWizard}
        busy={busy}
        onClose={() => setShowCreateWizard(false)}
        onCreate={async (parentDir, options) => {
          await handleCreateLibrary(parentDir, options);
          setShowCreateWizard(false);
        }}
      />

      {updateCheck.updateInfo && updateCheck.canInstallInApp && !updateCheck.dismissed ? (
        <UpdateAvailableDialog
          updateInfo={updateCheck.updateInfo}
          installing={updateCheck.installing}
          installState={updateCheck.installState}
          installError={updateCheck.error}
          onDismiss={updateCheck.dismiss}
          onInstall={() => void updateCheck.installNow()}
        />
      ) : null}
    </ThemeProvider>
  );
}

export default App;
