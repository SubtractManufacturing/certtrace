import { useEffect, useState } from "react";

/** Keep in sync with `--certtrace-overlay-duration` in the desktop app stylesheet. */
export const OVERLAY_TRANSITION_MS = 200;

export type OverlayMotionState = "open" | "closed";

export const overlayBackdropClassName = "certtrace-overlay-backdrop";
export const dialogPanelClassName = "certtrace-dialog-panel";
export const sheetPanelClassName = "certtrace-sheet-panel-motion";

export function overlayMotionState(visible: boolean): OverlayMotionState {
  return visible ? "open" : "closed";
}

export function useOverlayPresence(open: boolean) {
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setVisible(false);
      let innerFrame = 0;
      const outerFrame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outerFrame);
        cancelAnimationFrame(innerFrame);
      };
    }

    setVisible(false);
    const timer = window.setTimeout(() => setPresent(false), OVERLAY_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  return { present, visible };
}
