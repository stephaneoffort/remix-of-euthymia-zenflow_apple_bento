import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'mixed';
export type ThemePalette = 'clubroom' | 'neutrals' | 'sapphire' | 'cinematic' | 'teal' | 'bento2026' | 'bentoOcean' | 'bentoRose' | 'bentoAmber' | 'liquidGlass' | 'liquidGlassOcean' | 'liquidGlassAurora' | 'liquidGlassRose' | 'liquidGlassAmber' | 'liquidGlassViolet' | 'liquidGlassCoral' | 'liquidGlassSlate' | 'liquidGlassMidnight' | 'nmCloud' | 'nmMidnight';

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
  bento2026: {
    label: 'Bento 2026',
    description: 'Off-white chaud + Vert forêt — Tendance organique 2026',
    colors: ['#f5f0e8', '#ede8df', '#2d3a2e', '#a8d5b5'],
  },
  bentoOcean: {
    label: 'Bento Ocean',
    description: 'Bleu profond + Corail — Fraîcheur marine 2026',
    colors: ['#eef3f8', '#e4ecf4', '#1e3a5f', '#f0846a'],
  },
  bentoRose: {
    label: 'Bento Rose',
    description: 'Blush rosé + Bordeaux — Élégance douce 2026',
    colors: ['#f8f0f0', '#f0e6e6', '#5c2434', '#e8a0b0'],
  },
  bentoAmber: {
    label: 'Bento Amber',
    description: 'Ambre chaud + Charbon — Chaleur minérale 2026',
    colors: ['#f5efe5', '#ede6da', '#2e2a26', '#d4a04a'],
  },
  liquidGlass: {
    label: 'Liquid Glass',
    description: 'Apple iOS 26 — Verre translucide + fond vivant',
    colors: ['#e8f4ff', '#f0e8ff', '#6366f1', '#ffffff'],
  },
  liquidGlassOcean: {
    label: 'Liquid Glass Ocean',
    description: 'Bleu azur · reflets arctiques',
    colors: ['#e0f2fe', '#38bdf8', '#0284c7', '#6366f1'],
  },
  liquidGlassAurora: {
    label: 'Liquid Glass Aurora',
    description: 'Vert boréal · émeraude nordique',
    colors: ['#d1fae5', '#34d399', '#059669', '#6366f1'],
  },
  liquidGlassRose: {
    label: 'Liquid Glass Rose',
    description: 'Pétale nacré · quartz rose',
    colors: ['#ffe4e6', '#f472b6', '#be185d', '#fb7185'],
  },
  liquidGlassAmber: {
    label: 'Liquid Glass Amber',
    description: 'Or liquide · miel solaire',
    colors: ['#fef9c3', '#fbbf24', '#d97706', '#f97316'],
  },
  liquidGlassViolet: {
    label: 'Liquid Glass Violet',
    description: 'Améthyste · profondeur astrale',
    colors: ['#ede9fe', '#a78bfa', '#7c3aed', '#8b5cf6'],
  },
  liquidGlassCoral: {
    label: 'Liquid Glass Coral',
    description: 'Corail de mer · coucher de soleil',
    colors: ['#ffe4e6', '#fb7185', '#dc2626', '#f97316'],
  },
  liquidGlassSlate: {
    label: 'Liquid Glass Slate',
    description: 'Ardoise polie · brume minérale',
    colors: ['#f1f5f9', '#94a3b8', '#475569', '#64748b'],
  },
  liquidGlassMidnight: {
    label: 'Liquid Glass Midnight',
    description: 'Nuit profonde · indigo sombre',
    colors: ['#1e1b4b', '#6366f1', '#818cf8', '#0f172a'],
  },
  nmCloud: {
    label: 'Cloud',
    description: 'Soft UI · Gris perle · Jour',
    colors: ['#E8ECEF', '#C5C9CC', '#FFFFFF', '#4A7FA5'],
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
    const root = document.documentElement;
    root.classList.add('palette-transitioning');
    setThemeState(t);
    localStorage.setItem('euthymia-theme', t);
    setTimeout(() => root.classList.remove('palette-transitioning'), 500);
  };

  const setPalette = (p: ThemePalette) => {
    const root = document.documentElement;
    root.classList.add('palette-transitioning');
    setPaletteState(p);
    localStorage.setItem('euthymia-palette', p);
    setTimeout(() => root.classList.remove('palette-transitioning'), 500);
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
