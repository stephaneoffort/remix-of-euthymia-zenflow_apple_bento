import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "mixed";
export type ThemePalette =
  | "clubroom"
  | "neutrals"
  | "sapphire"
  | "cinematic"
  | "teal"
  | "bento2026"
  | "bentoOcean"
  | "bentoRose"
  | "bentoAmber"
  | "nmCloud"
  | "nmMidnight"
  | "nmSand"
  | "nmForest"
  | "nmLavender"
  | "nmDeepForest"
  | "ivoireChaud";

export type DesignMode = "classic" | "neumorphic";

export type TypeVariant = "default" | "editorial" | "geometric" | "nature";

export const TYPE_META: Record<TypeVariant, { label: string; description: string; display: string; body: string; numeric: string }> = {
  default: {
    label: "Défaut",
    description: "Plus Jakarta Sans · Équilibré & moderne",
    display: "'Plus Jakarta Sans', system-ui, sans-serif",
    body: "'Plus Jakarta Sans', system-ui, sans-serif",
    numeric: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  editorial: {
    label: "Éditorial",
    description: "Fraunces + Inter · Magazine raffiné",
    display: "'Fraunces', 'Playfair Display', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    numeric: "'JetBrains Mono', 'Fira Code', monospace",
  },
  geometric: {
    label: "Géométrique",
    description: "Space Grotesk · Tech contemporain",
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Space Grotesk', system-ui, sans-serif",
    numeric: "'JetBrains Mono', 'Fira Code', monospace",
  },
  nature: {
    label: "Nature",
    description: "Playfair + DM Sans · Organique chaleureux",
    display: "'Playfair Display', Georgia, serif",
    body: "'DM Sans', system-ui, sans-serif",
    numeric: "'DM Sans', system-ui, sans-serif",
  },
};

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  designMode: DesignMode;
  setDesignMode: (mode: DesignMode) => void;
  typeVariant: TypeVariant;
  setTypeVariant: (variant: TypeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const PALETTE_META: Record<ThemePalette, { label: string; description: string; colors: string[] }> = {
  clubroom: {
    label: "Obsidian & Gold",
    description: "Noir chromatique + Or signature — Luxe absolu",
    colors: ["#1A1924", "#C9A84C", "#13121A", "#F5EFE0"],
  },
  neutrals: {
    label: "Sable & Pierre",
    description: "Neutres élevés, sable chaud — Mature & premium",
    colors: ["#1E1C19", "#A08868", "#171513", "#F5F3EF"],
  },
  sapphire: {
    label: "Sapphire Depth",
    description: "Bleu profond + Teal — Tech B2B élégante",
    colors: ["#111620", "#2DD4BF", "#0C1018", "#EEF2F7"],
  },
  cinematic: {
    label: "Cinematic Glow",
    description: "Violet & Rose — Créatif & lifestyle premium",
    colors: ["#7C5CED", "#EC4899", "#0E0A1C", "#151026"],
  },
  teal: {
    label: "Ocean Teal",
    description: "Bleu-vert organique — Wellness & mindfulness",
    colors: ["#0F1C20", "#14B8A6", "#0A1518", "#E8FAF5"],
  },
  bento2026: {
    label: "Bento 2026",
    description: "Off-white chaud + Vert forêt — Tendance organique 2026",
    colors: ["#2d3a2e", "#a8d5b5", "#f5f0e8", "#ede8df"],
  },
  bentoOcean: {
    label: "Bento Ocean",
    description: "Bleu profond + Corail — Fraîcheur marine 2026",
    colors: ["#1e3a5f", "#f0846a", "#eef3f8", "#e4ecf4"],
  },
  bentoRose: {
    label: "Bento Rose",
    description: "Blush rosé + Bordeaux — Élégance douce 2026",
    colors: ["#5c2434", "#e8a0b0", "#f8f0f0", "#f0e6e6"],
  },
  bentoAmber: {
    label: "Bento Amber",
    description: "Ambre chaud + Charbon — Chaleur minérale 2026",
    colors: ["#2e2a26", "#d4a04a", "#f5efe5", "#ede6da"],
  },
  nmCloud: {
    label: "Cloud",
    description: "Soft UI · Gris perle · Jour",
    colors: ["#C5C9CC", "#4A7FA5", "#E8ECEF", "#FFFFFF"],
  },
  nmMidnight: {
    label: "Midnight",
    description: "Soft UI · Charbon · Nuit",
    colors: ["#1E2028", "#6B9BC0", "#12141A", "#2A2D38"],
  },
  nmSand: {
    label: "Sand",
    description: "Soft UI · Beige sable · Chaud",
    colors: ["#CAC5C0", "#A07840", "#EDE8E3", "#FFFFFF"],
  },
  nmForest: {
    label: "Forest",
    description: "Soft UI · Vert mousse · Zen",
    colors: ["#C3CAC5", "#4E7A45", "#E6EDE8", "#FFFFFF"],
  },
  nmLavender: {
    label: "Lavender",
    description: "Soft UI · Lavande · Spirituel",
    colors: ["#CAC5CD", "#7B5EA7", "#EDE8F0", "#FFFFFF"],
  },
  nmDeepForest: {
    label: "Deep Forest",
    description: "Soft UI · Vert sombre · Nuit",
    colors: ["#1A1F1A", "#5A9A6A", "#0F1210", "#252C25"],
  },
  ivoireChaud: {
    label: "Ivoire Chaud",
    description: "Crème doré · Terre cuite · Chaleur naturelle",
    colors: ["#c27838", "#3a2a1a", "#f5efe3", "#ede6d8"],
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("euthymia-theme") as ThemeMode) || "dark";
  });
  const [designMode, setDesignModeState] = useState<DesignMode>(() => {
    return (localStorage.getItem("euthymia-design-mode") as DesignMode) || "classic";
  });
  const setDesignMode = (m: DesignMode) => {
    const root = document.documentElement;
    root.classList.add("design-transitioning");
    setDesignModeState(m);
    localStorage.setItem("euthymia-design-mode", m);
    setTimeout(() => root.classList.remove("design-transitioning"), 600);
  };
  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    const stored = localStorage.getItem("euthymia-palette");
    // Migrate away from removed Liquid Glass palettes
    if (stored && stored.startsWith("liquidGlass")) return "sapphire";
    return (stored as ThemePalette) || "sapphire";
  });
  const [typeVariant, setTypeVariantState] = useState<TypeVariant>(() => {
    return (localStorage.getItem("euthymia-type") as TypeVariant) || "default";
  });

  const setTheme = (t: ThemeMode) => {
    const root = document.documentElement;
    root.classList.add("palette-transitioning");
    setThemeState(t);
    localStorage.setItem("euthymia-theme", t);
    setTimeout(() => root.classList.remove("palette-transitioning"), 500);
  };

  const setPalette = (p: ThemePalette) => {
    const root = document.documentElement;
    root.classList.add("palette-transitioning");
    setPaletteState(p);
    localStorage.setItem("euthymia-palette", p);
    setTimeout(() => root.classList.remove("palette-transitioning"), 100);
  };

  const setTypeVariant = (v: TypeVariant) => {
    setTypeVariantState(v);
    localStorage.setItem("euthymia-type", v);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "mixed");
    root.classList.add(theme === "mixed" ? "mixed" : theme === "light" ? "light" : "dark");
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
  }, [palette]);

  useEffect(() => {
    const root = document.documentElement;
    const meta = TYPE_META[typeVariant];
    root.style.setProperty("--font-display", meta.display);
    root.style.setProperty("--font-body", meta.body);
    root.style.setProperty("--font-numeric", meta.numeric);
    root.dataset.typeVariant = typeVariant;
  }, [typeVariant]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, palette, setPalette, designMode, setDesignMode, typeVariant, setTypeVariant }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
