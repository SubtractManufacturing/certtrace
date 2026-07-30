import { fireEvent, screen, waitFor, within } from "@testing-library/react";

async function getSelectListbox(combobox: HTMLElement): Promise<HTMLElement> {
  const listboxId = combobox.getAttribute("aria-controls");

  return waitFor(() => {
    if (listboxId) {
      const listbox = document.getElementById(listboxId);
      if (listbox) {
        return listbox;
      }
    }

    return screen.getByRole("listbox");
  });
}

export async function chooseSelectOption(
  combobox: HTMLElement,
  optionLabel: string | RegExp,
): Promise<void> {
  // fireEvent avoids user-event pointer-bounds checks that flake in jsdom when
  // the portaled listbox reports a 0×0 layout rect.
  fireEvent.click(combobox);
  const listbox = await getSelectListbox(combobox);
  fireEvent.click(within(listbox).getByRole("option", { name: optionLabel }));
}

export async function listOpenSelectOptionValues(combobox: HTMLElement): Promise<string[]> {
  fireEvent.click(combobox);
  const listbox = await getSelectListbox(combobox);
  const values = within(listbox)
    .getAllByRole("option")
    .map((option) => option.getAttribute("data-value") ?? "");
  fireEvent.click(combobox);
  return values;
}

export function getSelectValue(combobox: HTMLElement): string {
  return combobox.getAttribute("data-value") ?? "";
}
