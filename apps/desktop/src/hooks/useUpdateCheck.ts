import { useCallback, useEffect, useState } from "react";
import {
  type AvailableUpdate,
  canInstallInApp,
  checkForAppUpdate,
  installAvailableUpdate,
  type UpdateInstallState,
} from "../lib/update-client";

export type UpdateCheckPhase = "idle" | "checking" | "installing";

const AUTO_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

interface UseUpdateCheckOptions {
  enabled: boolean;
  autoCheck?: boolean;
  now?: () => number;
}

export function useUpdateCheck({
  enabled,
  autoCheck = true,
  now = Date.now,
}: UseUpdateCheckOptions) {
  const [updateInfo, setUpdateInfo] = useState<AvailableUpdate | null>(null);
  const [phase, setPhase] = useState<UpdateCheckPhase>("idle");
  const [installState, setInstallState] = useState<UpdateInstallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const dismissed = dismissedUntil !== null && now() < dismissedUntil;

  const checkNow = useCallback(async () => {
    setPhase("checking");
    setError(null);
    try {
      const result = await checkForAppUpdate();
      if (result.status === "available") {
        setUpdateInfo(result.info);
      } else {
        setUpdateInfo(null);
      }
      setHasChecked(true);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setPhase("idle");
    }
  }, []);

  const installNow = useCallback(async () => {
    if (!updateInfo || !canInstallInApp(updateInfo)) {
      return false;
    }

    setPhase("installing");
    setInstallState("downloading");
    setError(null);
    try {
      setInstallState("installing");
      await installAvailableUpdate(updateInfo.updater);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPhase("idle");
      setInstallState("idle");
      return false;
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    setDismissedUntil(now() + DISMISS_DURATION_MS);
  }, [now]);

  useEffect(() => {
    if (!enabled || !autoCheck) {
      return;
    }

    void checkNow().catch(() => undefined);
    const intervalId = window.setInterval(() => {
      void checkNow().catch(() => undefined);
    }, AUTO_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, autoCheck, checkNow]);

  useEffect(() => {
    if (dismissedUntil === null) {
      return;
    }

    const remainingMs = dismissedUntil - now();
    if (remainingMs <= 0) {
      setDismissedUntil(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDismissedUntil(null);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dismissedUntil, now]);

  return {
    updateInfo,
    checking: phase === "checking",
    installing: phase === "installing",
    installState,
    error,
    dismissed,
    dismiss,
    checkNow,
    installNow,
    hasChecked,
    canInstallInApp: updateInfo ? canInstallInApp(updateInfo) : false,
  };
}
