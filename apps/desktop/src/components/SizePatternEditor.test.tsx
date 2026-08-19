import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SizePatternEditor } from "./SizePatternEditor";

const values = [
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
];

function getEditor(): HTMLDivElement {
  return screen.getByRole("textbox", { name: "Size pattern" }) as HTMLDivElement;
}

function placeCaretAtEnd(editor: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.keyUp(editor, { key: "End" });
}

function placeCaretAfter(node: Node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function stubRect(element: Element, left: number, width = 40) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: left,
    y: 10,
    left,
    top: 10,
    right: left + width,
    bottom: 30,
    width,
    height: 20,
    toJSON: () => ({}),
  });
}

describe("SizePatternEditor", () => {
  it("renders chips and literal text for the incoming pattern", () => {
    render(
      <SizePatternEditor
        pattern="{width} x {height} {unit}"
        values={values}
        onChange={() => undefined}
      />,
    );

    const editor = getEditor();
    expect(editor.textContent).toBe("Width x Height Unit");
    expect(editor.querySelectorAll("[data-key]")).toHaveLength(3);
    expect(editor.querySelector<HTMLElement>('[data-key="width"]')?.textContent).toBe("Width");
    expect(editor.querySelector<HTMLElement>('[data-key="unit"]')?.textContent).toBe("Unit");
  });

  it("opens the add-value menu from the plus button", async () => {
    render(
      <SizePatternEditor
        pattern="{width} x {height} {unit}"
        values={values}
        onChange={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add value to Size pattern" }));
    expect(screen.getByRole("menuitem", { name: "Width" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Unit" })).toBeTruthy();
  });

  it("inserts a chip at the caret when a value is picked from the menu", async () => {
    const onChange = vi.fn();
    render(<SizePatternEditor pattern="" values={values} onChange={onChange} />);

    const editor = getEditor();
    editor.focus();
    placeCaretAtEnd(editor);

    await userEvent.click(screen.getByRole("button", { name: "Add value to Size pattern" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Width" }));

    expect(editor.querySelector<HTMLElement>('[data-key="width"]')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith("{width}");
  });

  it("emits the current pattern when the user types text between chips", () => {
    const onChange = vi.fn();
    render(<SizePatternEditor pattern="{width}{height}" values={values} onChange={onChange} />);

    const editor = getEditor();
    const width = editor.querySelector<HTMLElement>('[data-key="width"]');
    const height = editor.querySelector<HTMLElement>('[data-key="height"]');
    expect(width).toBeTruthy();
    expect(height).toBeTruthy();

    act(() => {
      const spacer = document.createTextNode(" x ");
      editor.insertBefore(spacer, height);
      fireEvent.input(editor);
    });

    expect(onChange).toHaveBeenLastCalledWith("{width} x {height}");
  });

  it("selects a chip on Backspace, then removes it on the next Backspace", async () => {
    const onChange = vi.fn();
    render(<SizePatternEditor pattern="{width} x {height}" values={values} onChange={onChange} />);

    const editor = getEditor();
    editor.focus();
    const height = editor.querySelector<HTMLElement>('[data-key="height"]');
    expect(height).toBeTruthy();
    placeCaretAfter(height!);

    await userEvent.keyboard("{Backspace}");
    expect(height!.className).toContain("ring-2");
    expect(editor.querySelector('[data-key="height"]')).toBeTruthy();

    await userEvent.keyboard("{Backspace}");
    expect(editor.querySelector('[data-key="height"]')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith("{width} x");
  });

  it("shows a drop indicator at the caret while a chip is being dragged", () => {
    render(
      <SizePatternEditor
        pattern="{width} x {height} {unit}"
        values={values}
        onChange={() => undefined}
      />,
    );

    const editor = getEditor();
    const width = editor.querySelector<HTMLElement>('[data-key="width"]');
    const height = editor.querySelector<HTMLElement>('[data-key="height"]');
    expect(width && height).toBeTruthy();
    stubRect(width!, 0);
    stubRect(height!, 100);

    Object.defineProperty(document, "caretRangeFromPoint", {
      configurable: true,
      writable: true,
      value: () => {
        const range = document.createRange();
        range.setStartBefore(width!);
        range.collapse(true);
        return range;
      },
    });

    fireEvent.pointerDown(height!, { pointerId: 1, button: 0, clientX: 110, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 5, clientY: 20 });

    expect(screen.getByTestId("size-pattern-drop-indicator")).toBeTruthy();

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 5, clientY: 20 });
    expect(screen.queryByTestId("size-pattern-drop-indicator")).toBeNull();
  });

  it("moves a chip when it is dragged onto another chip", () => {
    const onChange = vi.fn();
    render(
      <SizePatternEditor pattern="{width} x {height} {unit}" values={values} onChange={onChange} />,
    );

    const editor = getEditor();
    const width = editor.querySelector<HTMLElement>('[data-key="width"]');
    const height = editor.querySelector<HTMLElement>('[data-key="height"]');
    const unit = editor.querySelector<HTMLElement>('[data-key="unit"]');
    expect(width && height && unit).toBeTruthy();
    stubRect(width!, 0);
    stubRect(height!, 100);
    stubRect(unit!, 200);

    Object.defineProperty(document, "caretRangeFromPoint", {
      configurable: true,
      writable: true,
      value: () => {
        const range = document.createRange();
        range.setStartBefore(width!);
        range.collapse(true);
        return range;
      },
    });

    fireEvent.pointerDown(height!, { pointerId: 1, button: 0, clientX: 110, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 5, clientY: 20 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 5, clientY: 20 });

    const chips = Array.from(editor.querySelectorAll("[data-key]"));
    expect(chips.map((chip) => (chip as HTMLElement).dataset.key)).toEqual([
      "height",
      "width",
      "unit",
    ]);
    expect(onChange).toHaveBeenLastCalledWith("{height}{width} x  {unit}");
  });

  it("updates chip labels when the value labels change", async () => {
    const { rerender } = render(
      <SizePatternEditor pattern="{width}" values={values} onChange={() => undefined} />,
    );

    const editor = getEditor();
    const chip = editor.querySelector<HTMLElement>('[data-key="width"]');
    expect(chip?.textContent).toBe("Width");

    rerender(
      <SizePatternEditor
        pattern="{width}"
        values={[{ key: "width", label: "Across" }]}
        onChange={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(chip?.textContent).toBe("Across");
    });
    expect(chip?.getAttribute("aria-label")).toBe("Across");
  });

  it("does not throw when Backspace follows a parent-driven pattern replace", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SizePatternEditor pattern="{width} x {height}" values={values} onChange={onChange} />,
    );

    const editor = getEditor();
    editor.focus();
    const height = editor.querySelector<HTMLElement>('[data-key="height"]');
    expect(height).toBeTruthy();
    placeCaretAfter(height!);

    await userEvent.keyboard("{Backspace}");
    expect(height!.className).toContain("ring-2");

    rerender(<SizePatternEditor pattern="{width}" values={values} onChange={onChange} />);

    await userEvent.keyboard("{Backspace}");
    expect(editor.querySelector('[data-key="width"]')).toBeTruthy();
  });

  it("pastes clipboard content as a plain-text node", () => {
    const onChange = vi.fn();
    render(<SizePatternEditor pattern="{width}" values={values} onChange={onChange} />);

    const editor = getEditor();
    editor.focus();
    placeCaretAtEnd(editor);

    const clipboardData = {
      getData: (type: string) => (type === "text/plain" ? " x  extra " : "<b>x</b>"),
    };
    fireEvent.paste(editor, { clipboardData });

    expect(onChange).toHaveBeenLastCalledWith("{width} x extra");
  });
});
