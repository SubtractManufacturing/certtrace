import { Button } from "@certtrace/ui";
import { X } from "lucide-react";
import { openPathWithOpener } from "../lib/label-client";
import type { AvailableUpdate } from "../lib/update-client";
import { canInstallInApp, type UpdateInstallState } from "../lib/update-client";

interface UpdateAvailableDialogProps {
  updateInfo: AvailableUpdate;
  installing: boolean;
  installState: UpdateInstallState;
  installError: string | null;
  onDismiss: () => void;
  onInstall: () => void;
}

function releaseNotesSnippet(notes: string, maxLength = 240): string {
  const trimmed = notes.trim();
  if (!trimmed) {
    return "See the release page for details.";
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export function UpdateAvailableDialog({
  updateInfo,
  installing,
  installState,
  installError,
  onDismiss,
  onInstall,
}: UpdateAvailableDialogProps) {
  const inAppInstall = canInstallInApp(updateInfo);
  const installLabel =
    installState === "downloading"
      ? "Downloading…"
      : installState === "installing"
        ? "Installing…"
        : "Update now";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-description"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="update-dialog-title" className="text-lg font-semibold">
              Update available
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              CertTrace {updateInfo.latestVersion} is ready.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss update dialog"
            className="rounded-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            onClick={onDismiss}
            disabled={installing}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p
          id="update-dialog-description"
          className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400"
        >
          {releaseNotesSnippet(updateInfo.releaseNotes)}
        </p>

        {installError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{installError}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {inAppInstall ? (
            <Button type="button" size="sm" disabled={installing} onClick={onInstall}>
              {installLabel}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void openPathWithOpener(updateInfo.releaseUrl).catch((err) => {
                  console.error("Failed to open update URL:", err);
                });
              }}
            >
              Download update
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={installing}
            onClick={onDismiss}
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use UpdateAvailableDialog */
export const UpdateAvailableBanner = UpdateAvailableDialog;
