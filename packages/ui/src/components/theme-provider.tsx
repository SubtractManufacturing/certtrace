import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  theme?: Theme;
  defaultTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeProvider({
  children,
  theme: themeProp,
  defaultTheme = "light",
  onThemeChange,
}: ThemeProviderProps) {
  const [internalTheme, setInternalTheme] = useState<Theme>(defaultTheme);
  const theme = themeProp ?? internalTheme;

  const setTheme = useCallback(
    (next: Theme) => {
      if (themeProp === undefined) {
        setInternalTheme(next);
      }
      onThemeChange?.(next);
    },
    [themeProp, onThemeChange],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  // Apply before paint so dark: utilities and JS-driven theme UI (e.g. toggles)
  // start CSS transitions in the same frame.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
