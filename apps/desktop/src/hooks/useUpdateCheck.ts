import { useCallback, useEffect, useState } from "react";
import { checkForUpdates, type UpdateInfo } from "../lib/update-check";

interface UseUpdateCheckOptions {
  enabled: boolean;
  autoCheck?: boolean;
}

export function useUpdateCheck({ enabled, autoCheck = true }: UseUpdateCheckOptions) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [noReleasesPublished, setNoReleasesPublished] = useState(false);

  const checkNow = useCallback(async () => {
    setChecking(true);
    setError(null);
    setNoReleasesPublished(false);
    try {
      const result = await checkForUpdates();
      if (result.status === "available") {
        setUpdateInfo(result.info);
        setDismissed(false);
      } else {
        setUpdateInfo(null);
        setNoReleasesPublished(result.status === "no-releases");
      }
      setHasChecked(true);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !autoCheck) {
      return;
    }

    void checkNow().catch(() => undefined);
  }, [enabled, autoCheck, checkNow]);

  return {
    updateInfo,
    checking,
    error,
    dismissed,
    dismiss: () => setDismissed(true),
    checkNow,
    hasChecked,
    noReleasesPublished,
  };
}
