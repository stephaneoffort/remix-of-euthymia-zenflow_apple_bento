import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'mixed';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('euthymia-theme') as ThemeMode;
    return saved || 'dark';
  });

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem('euthymia-theme', t);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'mixed');
    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'mixed') {
      root.classList.add('mixed');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
