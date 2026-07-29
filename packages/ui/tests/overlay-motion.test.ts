import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OVERLAY_TRANSITION_MS,
  dialogPanelClassName,
  overlayBackdropClassName,
  overlayMotionState,
  sheetPanelClassName,
  useOverlayPresence,
} from "../src/lib/overlay-motion.js";

describe("overlay motion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports shared timing, class names, and motion state", () => {
    expect(OVERLAY_TRANSITION_MS).toBe(200);
    expect(overlayBackdropClassName).toBe("certtrace-overlay-backdrop");
    expect(dialogPanelClassName).toBe("certtrace-dialog-panel");
    expect(sheetPanelClassName).toBe("certtrace-sheet-panel-motion");
    expect(overlayMotionState(true)).toBe("open");
    expect(overlayMotionState(false)).toBe("closed");
  });

  it("keeps overlays mounted through the exit animation", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ open }) => useOverlayPresence(open), {
      initialProps: { open: true },
    });

    expect(result.current.present).toBe(true);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.visible).toBe(true);

    rerender({ open: false });

    expect(result.current.present).toBe(true);
    expect(result.current.visible).toBe(false);

    act(() => {
      vi.advanceTimersByTime(OVERLAY_TRANSITION_MS);
    });

    expect(result.current.present).toBe(false);
  });
});
