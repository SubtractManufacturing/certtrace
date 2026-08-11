import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "../src/components/select.js";

describe("Select", () => {
  it("renders the selected option label in the trigger", () => {
    render(
      <Select value="light" onChange={() => undefined}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>,
    );

    expect(screen.getByRole("combobox").textContent).toContain("Light");
    expect(screen.getByRole("combobox").getAttribute("data-value")).toBe("light");
  });

  it("opens a listbox and emits a synthetic change event", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Select aria-label="Theme" value="" onChange={onChange}>
        <option value="">Select…</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>,
    );

    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(screen.getByRole("option", { name: "Dark" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0].target.value).toBe("dark");
    expect(onChange.mock.calls[0]?.[0].target.selectedOptions[0]?.value).toBe("dark");
  });

  it("supports multi-select values through selectedOptions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <Select
          aria-label="Tags"
          multiple
          value={value}
          onChange={(event) => {
            const next = Array.from(event.target.selectedOptions, (option) => option.value);
            onChange(next);
            setValue(next);
          }}
        >
          <option value="a">Alpha</option>
          <option value="b">Beta</option>
        </Select>
      );
    }

    render(<Harness />);

    const listbox = screen.getByRole("listbox", { name: "Tags" });
    await user.click(within(listbox).getByRole("option", { name: "Alpha" }));
    await user.click(within(listbox).getByRole("option", { name: "Beta" }));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]?.[0]).toEqual(["a", "b"]);
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();

    render(
      <Select aria-label="Theme" disabled value="" onChange={() => undefined}>
        <option value="light">Light</option>
      </Select>,
    );

    await user.click(screen.getByRole("combobox", { name: "Theme" }));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("updates the trigger for uncontrolled selects", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Select aria-label="Theme" defaultValue="" onChange={onChange}>
        <option value="">Select…</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>,
    );

    const combobox = screen.getByRole("combobox", { name: "Theme" });
    expect(combobox.getAttribute("data-value")).toBe("");

    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Dark" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(combobox.getAttribute("data-value")).toBe("dark");
    expect(combobox.textContent).toContain("Dark");
  });

  it("moves keyboard highlight with arrow keys", async () => {
    const user = userEvent.setup();

    render(
      <Select aria-label="Theme" value="" onChange={() => undefined}>
        <option value="">Select…</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>,
    );

    const combobox = screen.getByRole("combobox", { name: "Theme" });
    combobox.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");

    const highlighted = screen
      .getAllByRole("option")
      .find((option) => option.getAttribute("data-highlighted") === "true");
    expect(highlighted?.getAttribute("data-value")).toBe("light");
  });

  it("filters options when searchable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Select
        aria-label="Material"
        searchable
        searchPlaceholder="Search materials…"
        value=""
        onChange={onChange}
      >
        <option value="">Select a material…</option>
        <option value="al-100">AL-100</option>
        <option value="st-200">ST-200</option>
      </Select>,
    );

    await user.click(screen.getByRole("combobox", { name: "Material" }));
    const search = screen.getByLabelText("Search materials…");
    await user.type(search, "st");

    expect(screen.queryByRole("option", { name: "AL-100" })).toBeNull();
    expect(screen.getByRole("option", { name: "ST-200" })).toBeTruthy();

    await user.click(screen.getByRole("option", { name: "ST-200" }));
    expect(onChange.mock.calls[0]?.[0].target.value).toBe("st-200");
  });
});
