import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "../src/components/theme-provider.js";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      theme:{theme}
    </button>
  );
}

describe("ThemeProvider", () => {
  it("applies the active theme class on the document root", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "theme:dark" })).toBeTruthy();
  });

  it("toggles between light and dark", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("light")).toBe(true);

    await user.click(screen.getByRole("button", { name: "theme:light" }));

    expect(screen.getByRole("button", { name: "theme:dark" })).toBeTruthy();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("throws when useTheme is used outside ThemeProvider", () => {
    expect(() => render(<ThemeProbe />)).toThrow("useTheme must be used within ThemeProvider");
  });
});
