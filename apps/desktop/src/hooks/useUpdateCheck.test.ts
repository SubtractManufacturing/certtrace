import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkForAppUpdateMock, installAvailableUpdateMock } = vi.hoisted(() => ({
  checkForAppUpdateMock: vi.fn(),
  installAvailableUpdateMock: vi.fn(),
}));

vi.mock("../lib/update-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/update-client")>("../lib/update-client");
  return {
    ...actual,
    checkForAppUpdate: checkForAppUpdateMock,
    installAvailableUpdate: installAvailableUpdateMock,
  };
});

import { useUpdateCheck } from "./useUpdateCheck";

const readyUpdate = {
  status: "available" as const,
  info: {
    latestVersion: "1.0.6",
    releaseNotes: "Notes",
    releaseUrl: "https://example.com",
    updater: { downloadAndInstall: vi.fn() },
  },
};

describe("useUpdateCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    checkForAppUpdateMock.mockReset();
    installAvailableUpdateMock.mockReset();
    checkForAppUpdateMock.mockResolvedValue({ status: "current" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not check on launch when automatic updates are off", async () => {
    renderHook(() => useUpdateCheck({ enabled: false }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkForAppUpdateMock).not.toHaveBeenCalled();
  });

  it("checks on launch and again every 60 minutes when automatic updates are on", async () => {
    renderHook(() => useUpdateCheck({ enabled: true }));

    await waitFor(() => {
      expect(checkForAppUpdateMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    });

    expect(checkForAppUpdateMock).toHaveBeenCalledTimes(2);
  });

  it("hides the update for 24 hours after Later, then shows it again", async () => {
    checkForAppUpdateMock.mockResolvedValue(readyUpdate);

    const { result } = renderHook(() => useUpdateCheck({ enabled: true }));

    await waitFor(() => {
      expect(result.current.updateInfo).not.toBeNull();
    });
    expect(result.current.dismissed).toBe(false);

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.dismissed).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000 - 1);
    });
    expect(result.current.dismissed).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.dismissed).toBe(false);
  });

  it("allows a manual check while automatic updates are off", async () => {
    const { result } = renderHook(() => useUpdateCheck({ enabled: false }));

    await act(async () => {
      await result.current.checkNow();
    });

    expect(checkForAppUpdateMock).toHaveBeenCalledTimes(1);
  });
});
