import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LibraryArchiveProgressDialog } from "./LibraryArchiveProgressDialog";

describe("LibraryArchiveProgressDialog", () => {
  it("shows Preparing… while the file count is still unknown", () => {
    render(
      <LibraryArchiveProgressDialog
        open
        progress={{ current: 0, total: 0, relativePath: "" }}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText("Preparing…")).toBeTruthy();
    expect(screen.queryByText(/Copying \d+ of \d+ files/)).toBeNull();
  });

  it("shows Copying N of M files and the current path", () => {
    render(
      <LibraryArchiveProgressDialog
        open
        progress={{ current: 3, total: 10, relativePath: "materials/AL-1/cert.pdf" }}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText("Copying 3 of 10 files")).toBeTruthy();
    expect(screen.getByText("materials/AL-1/cert.pdf")).toBeTruthy();
  });

  it("cancels from the dialog button, not overlay dismiss", async () => {
    const onCancel = vi.fn();
    render(
      <LibraryArchiveProgressDialog
        open
        progress={{ current: 1, total: 2, relativePath: "README.md" }}
        onCancel={onCancel}
      />,
    );

    await userEvent.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
