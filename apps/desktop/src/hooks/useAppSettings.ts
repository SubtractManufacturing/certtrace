import { useCallback, useEffect, useMemo, useState } from "react";
import type { Theme } from "@certtrace/ui";
import type { AppSettingsTheme, AppSettingsV1 } from "@certtrace/types";
import { loadAppSettings, saveAppSettings } from "../lib/app-settings-client";

function resolveTheme(theme: AppSettingsTheme): Theme {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettingsV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!settings || settings.theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSettings((current) => (current ? { ...current } : current));
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [settings?.theme]);

  const resolvedTheme = useMemo(
    () => resolveTheme(settings?.theme ?? "system"),
    [settings?.theme],
  );

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
    updateSettings,
    setTheme,
  };
}
