import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { inspectLibraryBackup, pickLibraryBackupZip } from "../lib/library-client";
import { RestoreLibraryWizard } from "./RestoreLibraryWizard";

vi.mock("../lib/library-client", () => ({
  inspectLibraryBackup: vi.fn(),
  pickLibraryBackupZip: vi.fn(),
  pickParentFolder: vi.fn(),
}));

describe("RestoreLibraryWizard", () => {
  it("stays on the ZIP step when the chosen file is not a library", async () => {
    vi.mocked(pickLibraryBackupZip).mockResolvedValue("/backups/notes.zip");
    vi.mocked(inspectLibraryBackup).mockRejectedValue(
      new Error("This ZIP is not a CertTrace library."),
    );

    render(
      <RestoreLibraryWizard open onClose={() => undefined} onRestore={async () => undefined} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose ZIP" }));

    expect(await screen.findByText("This ZIP is not a CertTrace library.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3 — ZIP")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled).toBe(true);
  });

  it("shows the library name after a valid ZIP is inspected", async () => {
    vi.mocked(pickLibraryBackupZip).mockResolvedValue("/backups/shop.zip");
    vi.mocked(inspectLibraryBackup).mockResolvedValue({
      name: "Main Shop",
      prefix: "",
    });

    render(
      <RestoreLibraryWizard open onClose={() => undefined} onRestore={async () => undefined} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose ZIP" }));

    await waitFor(() => expect(screen.getByText("Main Shop")).toBeTruthy());
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled).toBe(false);
  });
});
