import { ThemeProvider } from "@certtrace/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { WelcomeView } from "./WelcomeView";

function renderWelcome(ui: ReactElement) {
  return render(<ThemeProvider defaultTheme="light">{ui}</ThemeProvider>);
}

function noopWelcomeProps() {
  return {
    onOpenLibrary: async () => undefined,
    onStartCreateLibrary: () => undefined,
    onStartRestoreLibrary: () => undefined,
  };
}

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
    renderWelcome(<WelcomeView {...noopWelcomeProps()} onOpenLibrary={onOpenLibrary} />);

    expect(await screen.findByText("Main Shop")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Main Shop/i }));
    expect(onOpenLibrary).toHaveBeenCalledWith("/tmp/main-shop");
  });

  it("starts create library flow", async () => {
    const onStartCreateLibrary = vi.fn();
    renderWelcome(
      <WelcomeView {...noopWelcomeProps()} onStartCreateLibrary={onStartCreateLibrary} />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create library" })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Create library" }));
    expect(onStartCreateLibrary).toHaveBeenCalled();
  });

  it("makes create library the primary welcome action", async () => {
    renderWelcome(<WelcomeView {...noopWelcomeProps()} />);

    const createButton = await screen.findByRole("button", { name: "Create library" });
    const openButton = screen.getByRole("button", { name: "Open library" });
    const restoreButton = screen.getByRole("button", { name: "Restore from backup" });

    expect(createButton.compareDocumentPosition(openButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(openButton.compareDocumentPosition(restoreButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(createButton.className).toContain("w-full");
    expect(createButton.className).toContain("max-w-sm");
    expect(createButton.className).toContain("h-11");
    expect(createButton.className).toContain("bg-sky-500");
    expect(openButton.className).toContain("w-full");
    expect(openButton.className).toContain("text-center");
    expect(openButton.className).toContain("text-xs");
    expect(openButton.className).toContain("text-slate-500");
    expect(openButton.className).toContain("hover:underline");
    expect(openButton.className).not.toContain("hover:bg");
    expect(restoreButton.className).toBe(openButton.className);
    expect(openButton.parentElement).toBe(restoreButton.parentElement);
    expect(openButton.parentElement?.className).toContain("grid-cols-2");
    expect(openButton.parentElement?.className).toContain("max-w-sm");
  });

  it("shows a theme toggle in the welcome chrome", async () => {
    renderWelcome(<WelcomeView {...noopWelcomeProps()} />);

    const toggle = await screen.findByRole("switch", { name: /switch to dark mode/i });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toMatch(/switch to light mode/i);
  });

  it("renders a prominent CertTrace logo", async () => {
    renderWelcome(<WelcomeView {...noopWelcomeProps()} />);

    const logo = await screen.findByRole("img", { name: "CertTrace" });
    expect(logo.className).toContain("h-14");
  });

  it("opens library help from the welcome card", async () => {
    renderWelcome(<WelcomeView {...noopWelcomeProps()} />);

    await userEvent.click(await screen.findByRole("button", { name: "What is a library?" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What is a library?" })).toBeTruthy();
    expect(screen.getByText(/A library is a folder on your computer/)).toBeTruthy();
    expect(screen.getByText(/CertTrace creates a new library folder inside it/)).toBeTruthy();
  });

  it("starts restore from backup with the same weight as open library", async () => {
    const onStartRestoreLibrary = vi.fn();
    renderWelcome(
      <WelcomeView {...noopWelcomeProps()} onStartRestoreLibrary={onStartRestoreLibrary} />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Restore from backup" }));
    expect(onStartRestoreLibrary).toHaveBeenCalled();
  });
});
