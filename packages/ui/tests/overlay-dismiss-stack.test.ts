import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearOverlayDismissLayersForTests,
  registerOverlayDismissLayer,
} from "../src/lib/overlay-dismiss-stack.js";

describe("overlay-dismiss-stack", () => {
  afterEach(() => {
    clearOverlayDismissLayersForTests();
  });

  it("dismisses only the top layer on Escape", () => {
    const dismissTop = vi.fn();
    const dismissBottom = vi.fn();

    registerOverlayDismissLayer({
      dismiss: dismissBottom,
      shouldDismissOnPointerDown: () => false,
    });
    registerOverlayDismissLayer({ dismiss: dismissTop, shouldDismissOnPointerDown: () => false });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(dismissTop).toHaveBeenCalledTimes(1);
    expect(dismissBottom).not.toHaveBeenCalled();
  });

  it("dismisses the top outside-click layer and blocks lower backdrop handlers", () => {
    const dismissMenu = vi.fn();
    const dismissDialog = vi.fn();
    const backdrop = document.createElement("div");
    backdrop.className = "certtrace-overlay-backdrop";
    document.body.appendChild(backdrop);

    registerOverlayDismissLayer({
      dismiss: dismissDialog,
      shouldDismissOnPointerDown: (target) => target === backdrop,
    });
    registerOverlayDismissLayer({
      dismiss: dismissMenu,
      shouldDismissOnPointerDown: () => true,
      blockPointerDismiss: (target) =>
        target instanceof Element && target.classList.contains("certtrace-overlay-backdrop"),
    });

    const blocked = vi.fn();
    backdrop.addEventListener("mousedown", blocked);

    backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(dismissMenu).toHaveBeenCalledTimes(1);
    expect(dismissDialog).not.toHaveBeenCalled();
    expect(blocked).not.toHaveBeenCalled();

    backdrop.remove();
  });

  it("dismisses a dialog backdrop when it is the top layer", () => {
    const dismissDialog = vi.fn();
    const backdrop = document.createElement("div");
    document.body.appendChild(backdrop);

    registerOverlayDismissLayer({
      dismiss: dismissDialog,
      shouldDismissOnPointerDown: (target) => target === backdrop,
    });

    backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(dismissDialog).toHaveBeenCalledTimes(1);

    backdrop.remove();
  });
});
