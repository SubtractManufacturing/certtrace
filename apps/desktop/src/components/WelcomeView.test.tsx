import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WelcomeView } from "./WelcomeView";

vi.mock("../lib/app-settings-client", () => ({
  loadAppSettings: vi.fn(async () => ({
    version: 1 as const,
    theme: "system" as const,
    recentLibraries: [
      {
        path: "/tmp/main-shop",
        name: "Main Shop",
        lastOpenedAt: "2026-05-28T12:00:00.000Z",
      },
    ],
    checkForUpdates: true,
    defaultLibraryOnLaunch: null,
  })),
  forgetRecentLibrary: vi.fn(async () => ({
    version: 1 as const,
    theme: "system" as const,
    recentLibraries: [],
    checkForUpdates: true,
    defaultLibraryOnLaunch: null,
  })),
}));

vi.mock("../lib/library-client", () => ({
  pickParentFolder: vi.fn(async () => "/tmp/picked"),
}));

describe("WelcomeView", () => {
  it("shows recent libraries and opens one", async () => {
    const onOpenLibrary = vi.fn(async () => undefined);
    render(
      <WelcomeView onOpenLibrary={onOpenLibrary} onStartCreateLibrary={() => undefined} />,
    );

    expect(await screen.findByText("Main Shop")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Main Shop/i }));
    expect(onOpenLibrary).toHaveBeenCalledWith("/tmp/main-shop");
  });

  it("starts create library flow", async () => {
    const onStartCreateLibrary = vi.fn();
    render(
      <WelcomeView onOpenLibrary={async () => undefined} onStartCreateLibrary={onStartCreateLibrary} />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create library" })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Create library" }));
    expect(onStartCreateLibrary).toHaveBeenCalled();
  });

  it("makes create library the primary welcome action", async () => {
    render(
      <WelcomeView onOpenLibrary={async () => undefined} onStartCreateLibrary={() => undefined} />,
    );

    const createButton = await screen.findByRole("button", { name: "Create library" });
    const openButton = screen.getByRole("button", { name: "Open library" });

    expect(createButton.compareDocumentPosition(openButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(createButton.className).toContain("w-full");
    expect(createButton.className).toContain("max-w-sm");
    expect(createButton.className).toContain("h-11");
    expect(createButton.className).toContain("bg-sky-500");
    expect(openButton.className).toContain("w-full");
    expect(openButton.className).toContain("max-w-sm");
    expect(openButton.className).toContain("text-xs");
    expect(openButton.className).toContain("text-slate-500");
    expect(openButton.className).toContain("hover:underline");
    expect(openButton.className).not.toContain("hover:bg");
  });
});
