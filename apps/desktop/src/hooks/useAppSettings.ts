import type { AppSettingsTheme, AppSettingsV1 } from "@certtrace/types";
import type { Theme } from "@certtrace/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadAppSettings, saveAppSettings } from "../lib/app-settings-client";

function resolveTheme(theme: AppSettingsTheme, prefersDark: boolean): Theme {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }
  return theme;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettingsV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await loadAppSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(settings?.theme ?? "system", prefersDark),
    [settings?.theme, prefersDark],
  );

  const applySettings = useCallback((next: AppSettingsV1) => {
    setSettings(next);
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettingsV1>) => {
      if (!settings) {
        return;
      }
      const next = { ...settings, ...partial };
      await saveAppSettings(next);
      setSettings(next);
    },
    [settings],
  );

  const setTheme = useCallback(
    async (theme: AppSettingsTheme) => {
      await updateSettings({ theme });
    },
    [updateSettings],
  );

  return {
    settings,
    loading,
    error,
    resolvedTheme,
    refresh,
    applySettings,
    updateSettings,
    setTheme,
  };
}
