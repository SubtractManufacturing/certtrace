import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function getSelectListbox(combobox: HTMLElement): HTMLElement {
  const listboxId = combobox.getAttribute("aria-controls");
  if (listboxId) {
    const listbox = document.getElementById(listboxId);
    if (listbox) {
      return listbox;
    }
  }

  return screen.getByRole("listbox");
}

export async function chooseSelectOption(
  combobox: HTMLElement,
  optionLabel: string | RegExp,
): Promise<void> {
  await userEvent.click(combobox);
  const listbox = getSelectListbox(combobox);
  await userEvent.click(within(listbox).getByRole("option", { name: optionLabel }));
}

export async function listOpenSelectOptionValues(combobox: HTMLElement): Promise<string[]> {
  await userEvent.click(combobox);
  const listbox = getSelectListbox(combobox);
  const values = within(listbox)
    .getAllByRole("option")
    .map((option) => option.getAttribute("data-value") ?? "");
  await userEvent.click(combobox);
  return values;
}

export function getSelectValue(combobox: HTMLElement): string {
  return combobox.getAttribute("data-value") ?? "";
}
