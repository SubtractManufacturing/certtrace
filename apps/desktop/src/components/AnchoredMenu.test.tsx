import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { AnchoredMenu } from "./AnchoredMenu";

function ExampleMenu() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        ref={anchorRef}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Open menu
      </button>
      <button type="button">Outside</button>
      <AnchoredMenu open={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <button type="button">Inside</button>
      </AnchoredMenu>
    </div>
  );
}

describe("AnchoredMenu", () => {
  it("closes when clicking outside the menu", async () => {
    render(<ExampleMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe(
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Outside" }));

    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
