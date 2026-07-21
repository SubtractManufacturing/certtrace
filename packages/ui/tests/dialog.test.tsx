import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../src/components/dialog.js";

function ExampleDialog({
  open,
  onOpenChange,
  defaultOpen = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger>Open details</DialogTrigger>
      <DialogContent>
        <DialogTitle>Certificate details</DialogTitle>
        <DialogDescription>Heat lot ABC-123</DialogDescription>
        <DialogClose>Dismiss</DialogClose>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens from the trigger and closes from the close control", async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Heat lot ABC-123")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<ExampleDialog defaultOpen />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports open changes when controlled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ExampleDialog open={false} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Open details" }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
