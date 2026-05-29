import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@certtrace/ui";
import { AppShell, type AppView } from "./components/AppShell";
import { CreateLibraryWizard } from "./components/CreateLibraryWizard";
import { ErrorBanner } from "./components/ErrorBanner";
import { LibrarySettingsView } from "./components/LibrarySettingsView";
import { MaterialsWorkspace } from "./components/MaterialsWorkspace";
import { SettingsView } from "./components/SettingsView";
import { WelcomeView } from "./components/WelcomeView";
import { useAppSettings } from "./hooks/useAppSettings";
import { useLibrarySession } from "./hooks/useLibrarySession";
import { useSearchIndex } from "./hooks/useSearchIndex";
import { onLibraryFsChanged, syncLibraryWatch } from "./lib/library-watch";

function App() {
  const { settings, resolvedTheme, error: settingsError, setTheme, updateSettings } =
    useAppSettings();
  const session = useLibrarySession();
  const [activeView, setActiveView] = useState<AppView>("materials");
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recentLibraries = settings?.recentLibraries ?? [];

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

  const libraryOptions = useMemo(
    () =>
      [...session.sessionLibraries.entries()].map(([path, library]) => ({
        path,
        name: library.config.name,
      })),
    [session.sessionLibraries],
  );

  useEffect(() => {
    if (!session.hasSession || session.activeLibraryPath) {
      return;
    }
    session.setActiveLibraryPath(
      session.sessionLibraries.size > 1 ? "all" : [...session.sessionLibraries.keys()][0] ?? null,
    );
  }, [session.hasSession, session.activeLibraryPath, session.sessionLibraries, session.setActiveLibraryPath]);

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
  }, [refreshLibraryMaterials, session.sessionLibraries]);

  async function handleOpenLibrary(path: string) {
    setBusy(true);
    setError(null);
    try {
      await session.openLibrary(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLibrary(parentDir: string, options: Parameters<typeof session.createLibrary>[1]) {
    setBusy(true);
    setError(null);
    try {
      await session.createLibrary(parentDir, options);
      setActiveView("materials");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (!session.hasSession) {
    return (
      <ThemeProvider theme={resolvedTheme}>
        <WelcomeView
          busy={busy}
          onOpenLibrary={handleOpenLibrary}
          onStartCreateLibrary={() => setShowCreateWizard(true)}
        />
        <CreateLibraryWizard
          open={showCreateWizard}
          busy={busy}
          onClose={() => setShowCreateWizard(false)}
          onCreate={handleCreateLibrary}
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

  return (
    <ThemeProvider theme={resolvedTheme}>
      <AppShell
        activeView={activeView}
        onViewChange={setActiveView}
        libraries={libraryOptions}
        activeLibraryPath={session.activeLibraryPath}
        onLibraryChange={session.setActiveLibraryPath}
        onAddLibrary={() => setShowCreateWizard(true)}
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
          />
        ) : null}

        {activeView === "settings" && settings ? (
          <SettingsView
            theme={settings.theme}
            checkForUpdates={settings.checkForUpdates}
            onThemeChange={(theme) => void setTheme(theme)}
            onCheckForUpdatesChange={(value) => void updateSettings({ checkForUpdates: value })}
          />
        ) : null}

        {activeView === "library-settings" && activeLibrary ? (
          <LibrarySettingsView
            library={activeLibrary}
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
    </ThemeProvider>
  );
}

export default App;
