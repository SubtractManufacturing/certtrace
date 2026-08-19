import { cleanup } from "@testing-library/react";
import { clearOverlayDismissLayersForTests } from "@certtrace/ui";
import { afterEach } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  clearOverlayDismissLayersForTests();
});
