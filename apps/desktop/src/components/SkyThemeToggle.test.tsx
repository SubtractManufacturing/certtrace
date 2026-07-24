import { ThemeProvider } from "@certtrace/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkyThemeToggle } from "./SkyThemeToggle";

describe("SkyThemeToggle", () => {
  it("toggles between light and dark without visible text labels", async () => {
    const onThemeChange = vi.fn();
    render(
      <ThemeProvider defaultTheme="light" onThemeChange={onThemeChange}>
        <SkyThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("switch", { name: /switch to dark mode/i });
    expect(toggle.textContent?.trim()).toBe("");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(toggle);

    expect(onThemeChange).toHaveBeenCalledWith("dark");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: /switch to light mode/i })).toBeTruthy();
  });
});
