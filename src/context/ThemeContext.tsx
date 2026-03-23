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
    label: 'Obsidian & Gold',
    description: 'Noir chromatique + Or signature — Luxe absolu',
    colors: ['#13121A', '#1A1924', '#C9A84C', '#F5EFE0'],
  },
  neutrals: {
    label: 'Sable & Pierre',
    description: 'Neutres élevés, sable chaud — Mature & premium',
    colors: ['#171513', '#1E1C19', '#A08868', '#F5F3EF'],
  },
  sapphire: {
    label: 'Sapphire Depth',
    description: 'Bleu profond + Teal — Tech B2B élégante',
    colors: ['#0C1018', '#111620', '#2DD4BF', '#EEF2F7'],
  },
  cinematic: {
    label: 'Cinematic Glow',
    description: 'Violet & Rose — Créatif & lifestyle premium',
    colors: ['#0E0A1C', '#151026', '#7C5CED', '#EC4899'],
  },
  teal: {
    label: 'Ocean Teal',
    description: 'Bleu-vert organique — Wellness & mindfulness',
    colors: ['#0A1518', '#0F1C20', '#14B8A6', '#E8FAF5'],
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
    <ThemeContext.Provider value={{ theme, setTheme, palette, setPalette, savePaletteToDb }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
