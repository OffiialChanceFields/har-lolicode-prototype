// src/contexts/ThemeProviderContext.ts
import { createContext } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);
