import { useCallback, useEffect, useState } from "react";
import {
  type AvailableUpdate,
  canInstallInApp,
  checkForAppUpdate,
  installAvailableUpdate,
  type UpdateInstallState,
} from "../lib/update-client";

export type UpdateCheckPhase = "idle" | "checking" | "installing";

interface UseUpdateCheckOptions {
  enabled: boolean;
  autoCheck?: boolean;
}

export function useUpdateCheck({ enabled, autoCheck = true }: UseUpdateCheckOptions) {
  const [updateInfo, setUpdateInfo] = useState<AvailableUpdate | null>(null);
  const [phase, setPhase] = useState<UpdateCheckPhase>("idle");
  const [installState, setInstallState] = useState<UpdateInstallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [noReleasesPublished, setNoReleasesPublished] = useState(false);
  const [artifactsPending, setArtifactsPending] = useState(false);

  const checkNow = useCallback(async () => {
    setPhase("checking");
    setError(null);
    setNoReleasesPublished(false);
    setArtifactsPending(false);
    try {
      const result = await checkForAppUpdate();
      if (result.status === "available") {
        setUpdateInfo(result.info);
        setDismissed(false);
      } else {
        setUpdateInfo(null);
        setNoReleasesPublished(result.status === "no-releases");
        setArtifactsPending(result.status === "pending-artifacts");
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

  useEffect(() => {
    if (!enabled || !autoCheck) {
      return;
    }

    void checkNow().catch(() => undefined);
  }, [enabled, autoCheck, checkNow]);

  return {
    updateInfo,
    checking: phase === "checking",
    installing: phase === "installing",
    installState,
    error,
    dismissed,
    dismiss: () => setDismissed(true),
    checkNow,
    installNow,
    hasChecked,
    noReleasesPublished,
    artifactsPending,
    canInstallInApp: updateInfo ? canInstallInApp(updateInfo) : false,
  };
}
