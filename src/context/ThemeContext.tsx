import React, { createContext, useContext, useState, useEffect } from "react";

/** Préférence choisie par l'utilisateur : suit le système, ou forcée clair/sombre. */
export type ThemeMode = "system" | "light" | "dark";

/** Thème effectivement appliqué à l'écran (résolution de "system"). */
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "euthymia-theme";

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Migration depuis l'ancien système (light/dark/mixed) : "mixed" n'existe plus.
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? resolveSystemTheme() : theme,
  );

  const setTheme = (t: ThemeMode) => {
    const root = document.documentElement;
    root.classList.add("palette-transitioning");
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    setTimeout(() => root.classList.remove("palette-transitioning"), 500);
  };

  // Résout le thème effectif et l'applique sur <html>.
  useEffect(() => {
    const resolved = theme === "system" ? resolveSystemTheme() : theme;
    setResolvedTheme(resolved);

    const root = document.documentElement;
    root.classList.remove("light", "dark", "mixed");
    root.classList.add(resolved);
  }, [theme]);

  // Suit les changements de réglage du système quand theme === "system".
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = resolveSystemTheme();
      setResolvedTheme(resolved);
      const root = document.documentElement;
      root.classList.remove("light", "dark", "mixed");
      root.classList.add(resolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
