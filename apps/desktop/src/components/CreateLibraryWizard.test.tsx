import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pickParentFolder } from "../lib/library-client";
import { CreateLibraryWizard } from "./CreateLibraryWizard";

vi.mock("../lib/library-client", () => ({
  pickParentFolder: vi.fn(),
}));

describe("CreateLibraryWizard", () => {
  it("shows folder-pick progress until the selected path is ready", async () => {
    let resolvePick: (path: string) => void = () => undefined;
    vi.mocked(pickParentFolder).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        }),
    );

    render(
      <CreateLibraryWizard
        open
        onClose={() => undefined}
        onCreate={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Choose folder" }));

    expect(screen.getByText("Applying folder selection...")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Choose folder" }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled).toBe(true);

    resolvePick("C:\\Users\\jkkic\\Documents");

    await waitFor(() =>
      expect(screen.getByText("C:\\Users\\jkkic\\Documents")).toBeTruthy(),
    );
    expect(screen.queryByText("Applying folder selection...")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Choose folder" }).disabled).toBe(
      false,
    );
  });
});
