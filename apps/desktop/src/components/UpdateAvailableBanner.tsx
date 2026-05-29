import { Button } from "@certtrace/ui";
import { X } from "lucide-react";
import type { UpdateInfo } from "../lib/update-check";
import { openPathWithOpener } from "../lib/label-client";

interface UpdateAvailableBannerProps {
  updateInfo: UpdateInfo;
  onDismiss: () => void;
}

export function UpdateAvailableBanner({ updateInfo, onDismiss }: UpdateAvailableBannerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Update available</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            CertTrace {updateInfo.latestVersion} is ready to download.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss update notification"
          className="rounded-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => void openPathWithOpener(updateInfo.releaseUrl)}>
          Update now
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          Later
        </Button>
      </div>
    </div>
  );
}
