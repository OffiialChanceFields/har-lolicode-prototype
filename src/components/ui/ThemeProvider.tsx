 
import { useEffect, useState } from "react";
import { ThemeProviderContext } from "./ThemeProviderContext";

type Theme = "dark" | "light" | "system";

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "vite-ui-theme" }: { children: React.ReactNode, defaultTheme?: Theme, storageKey?: string }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = { theme, setTheme: (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
  }};

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
