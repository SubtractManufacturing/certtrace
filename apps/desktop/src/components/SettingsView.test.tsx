import { createDefaultAppSettingsV1 } from "@certtrace/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrinterSettingsProvider } from "../contexts/PrinterSettingsContext";
import { SettingsView } from "./SettingsView";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../lib/app-data-client", () => ({
  openAppDataFolder: vi.fn(),
}));

vi.mock("../lib/printer-client", () => ({
  listOsPrinterQueues: vi.fn(async () => ["Zebra ZD421", "Brother QL"]),
}));

const baseProps = {
  theme: "light" as const,
  resolvedTheme: "light" as const,
  checkForUpdates: false,
  includeArchivedMaterialsInSearch: false,
  defaultUnit: "in" as const,
  defaultLibraryOnLaunch: null,
  recentLibraries: [
    {
      path: "/tmp/main-shop",
      name: "Main Shop",
      lastOpenedAt: "2026-05-28T12:00:00.000Z",
    },
  ],
  checkingForUpdates: false,
  installingUpdate: false,
  updateAvailable: false,
  canInstallInApp: false,
  updateError: null,
  hasCheckedForUpdates: false,
  onThemeChange: () => undefined,
  onCheckForUpdatesChange: () => undefined,
  onIncludeArchivedMaterialsInSearchChange: () => undefined,
  onDefaultUnitChange: () => undefined,
  onDefaultLibraryChange: () => undefined,
  onAddLibrary: () => undefined,
  onCreateLibrary: () => undefined,
  onRestoreLibrary: () => undefined,
  onBackupLibrary: () => undefined,
  onRemoveLibrary: async () => undefined,
  onOpenLibrarySettings: () => undefined,
  onCheckForUpdatesNow: () => undefined,
  onInstallUpdate: () => undefined,
};

describe("SettingsView", () => {
  it("offers restore from backup next to add and create", () => {
    const onRestoreLibrary = vi.fn();
    render(<SettingsView {...baseProps} onRestoreLibrary={onRestoreLibrary} />);

    expect(screen.getByRole("button", { name: "Add library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore from backup" })).toBeTruthy();
  });

  it("backs up a library from its row", async () => {
    const onBackupLibrary = vi.fn();
    render(<SettingsView {...baseProps} onBackupLibrary={onBackupLibrary} />);

    await userEvent.click(screen.getByRole("button", { name: "Backup Main Shop" }));
    expect(onBackupLibrary).toHaveBeenCalledWith("/tmp/main-shop");
  });

  it("shows restore from backup when no libraries are added", () => {
    render(<SettingsView {...baseProps} recentLibraries={[]} />);

    expect(screen.getByText("No libraries added yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore from backup" })).toBeTruthy();
  });

  it("adds a Printer from an unused live OS queue", async () => {
    const onSettingsChange = vi.fn(async () => undefined);
    const settings = {
      ...createDefaultAppSettingsV1(),
      printers: [{ id: "zebra", name: "Rack labels", queueName: "Zebra ZD421" }],
    };
    render(
      <PrinterSettingsProvider settings={settings} onSettingsChange={onSettingsChange}>
        <SettingsView {...baseProps} />
      </PrinterSettingsProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add printer" }));
    await userEvent.click(screen.getByLabelText("OS queue"));
    expect(await screen.findByRole("option", { name: "Brother QL" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Zebra ZD421" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save printer" }));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        printers: expect.arrayContaining([
          expect.objectContaining({ name: "Brother QL", queueName: "Brother QL" }),
        ]),
      }),
    );
  });
});
