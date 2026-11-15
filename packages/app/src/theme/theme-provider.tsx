import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { ThemeMode, ColorPreset } from "../types/app.js";
import type { HonoCubeTheme } from "./theme-contract.js";

export interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  preset: ColorPreset | string;
  setPreset: (preset: ColorPreset | string) => void;
  resolvedTheme: "light" | "dark";
  activeTheme?: HonoCubeTheme;
  setActiveTheme?: (theme: HonoCubeTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  defaultPreset?: ColorPreset | string;
  storageKeyTheme?: string;
  storageKeyPreset?: string;
  themeContract?: HonoCubeTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultPreset = "zinc",
  storageKeyTheme = "honocube-theme",
  storageKeyPreset = "honocube-theme-preset",
  themeContract,
}: ThemeProviderProps): React.JSX.Element {
  const initialThemeMode = themeContract?.defaultMode || defaultTheme;
  const initialPreset = themeContract?.defaultPreset || defaultPreset;

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKeyTheme);
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
    return initialThemeMode;
  });

  const [preset, setPresetState] = useState<ColorPreset | string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKeyPreset);
      if (stored) return stored;
    }
    return initialPreset;
  });

  const [activeTheme, setActiveTheme] = useState<HonoCubeTheme | undefined>(
    themeContract
  );

  useEffect(() => {
    if (themeContract) {
      setActiveTheme(themeContract);
    }
  }, [themeContract]);

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Listen to system preference changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Apply .dark class and data-theme attribute to document.documentElement
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-theme", preset);
  }, [resolvedTheme, preset]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKeyTheme, newTheme);
    }
  };

  const setPreset = (newPreset: ColorPreset | string) => {
    setPresetState(newPreset);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKeyPreset, newPreset);
    }
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      preset,
      setPreset,
      resolvedTheme,
      activeTheme,
      setActiveTheme,
    }),
    [theme, preset, resolvedTheme, activeTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system",
      setTheme: () => {},
      preset: "zinc",
      setPreset: () => {},
      resolvedTheme: "light",
      activeTheme: undefined,
      setActiveTheme: () => {},
    };
  }
  return ctx;
}

export function useAppTheme(): HonoCubeTheme | undefined {
  const ctx = useContext(ThemeContext);
  return ctx?.activeTheme;
}
