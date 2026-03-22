import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'mixed';
export type ThemePalette = 'clubroom' | 'neutrals' | 'sapphire' | 'cinematic' | 'teal';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const PALETTE_META: Record<ThemePalette, { label: string; description: string; colors: string[] }> = {
  clubroom: {
    label: 'Clubroom Contrast',
    description: 'Noir profond + Or chaud — Luxe & confiance',
    colors: ['#1A1A1A', '#2D2D2D', '#D4A853', '#F5F0E8'],
  },
  neutrals: {
    label: 'Elevated Neutrals',
    description: 'Gris doux, sable chaud — Mature & reposant',
    colors: ['#F7F5F2', '#E8E2DA', '#B8AFA6', '#2D2926'],
  },
  sapphire: {
    label: 'Sapphire Depth',
    description: 'Bleu saphir profond — Tech & élégance',
    colors: ['#1B2A4A', '#2E5090', '#F8F9FB', '#E8ECF2'],
  },
  cinematic: {
    label: 'Cinematic Glow',
    description: 'Gradients doux et cinématiques — Tech premium',
    colors: ['#0F0B1E', '#1A1035', '#7C3AED', '#EC4899'],
  },
  teal: {
    label: 'Ocean Teal',
    description: 'Bleu-vert océan — Mystère & modernité',
    colors: ['#0A1A1F', '#134E4A', '#14B8A6', '#CCFBF1'],
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('euthymia-theme') as ThemeMode) || 'dark';
  });
  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    return (localStorage.getItem('euthymia-palette') as ThemePalette) || 'sapphire';
  });

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem('euthymia-theme', t);
  };

  const setPalette = (p: ThemePalette) => {
    setPaletteState(p);
    localStorage.setItem('euthymia-palette', p);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'mixed');
    root.classList.add(theme === 'mixed' ? 'mixed' : theme === 'light' ? 'light' : 'dark');
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
  }, [palette]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
