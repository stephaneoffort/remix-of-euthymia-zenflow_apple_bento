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
  | "ivoireChaud"
  | "dunesCuivre"
  | "crepuscule"
  | "brumeArdoise"
  | "prunelle"
  | "azurProfond"
  | "auroreCorail"
  | "braiseNocturne"
  // Variantes Bento (style mesh-gradient + bento-cell)
  | "bentoDunesCuivre"
  | "bentoCrepuscule"
  | "bentoBrumeArdoise"
  | "bentoPrunelle"
  | "bentoAzurProfond"
  | "bentoAuroreCorail"
  | "bentoBraiseNocturne"
  // Variantes Neumorphism (Soft UI)
  | "nmDunesCuivre"
  | "nmCrepuscule"
  | "nmBrumeArdoise"
  | "nmPrunelle"
  | "nmAzurProfond"
  | "nmAuroreCorail"
  | "nmBraiseNocturne";

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
  /** Opacité du fond du TaskDetailPanel pour les thèmes Bento (0.5 → 1) */
  taskPanelOpacity: number;
  setTaskPanelOpacity: (value: number) => void;
}

/** Liste des palettes Bento — utilisée pour conditionner les réglages spécifiques. */
export const BENTO_PALETTES: ThemePalette[] = [
  "bento2026",
  "bentoOcean",
  "bentoRose",
  "bentoAmber",
  "bentoDunesCuivre",
  "bentoCrepuscule",
  "bentoBrumeArdoise",
  "bentoPrunelle",
  "bentoAzurProfond",
  "bentoAuroreCorail",
  "bentoBraiseNocturne",
];

export function isBentoPalette(p: ThemePalette): boolean {
  return BENTO_PALETTES.includes(p);
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
    label: "Premium Chaud",
    description: "Crème doré · Terre cuite · Chaleur naturelle",
    colors: ["#c27838", "#3a2a1a", "#f5efe3", "#ede6d8"],
  },
  dunesCuivre: {
    label: "Dunes Cuivre",
    description: "Bleu nuit · Cuivre chaud · Sable minéral",
    colors: ["#10232A", "#B58863", "#3D4D55", "#D3C3B9"],
  },
  crepuscule: {
    label: "Crépuscule",
    description: "Bleu nuit · Lavande · Corail tendre",
    colors: ["#03122F", "#F1916D", "#413B61", "#F3DADF"],
  },
  brumeArdoise: {
    label: "Brume Ardoise",
    description: "Ardoise profonde · Brume claire · Sobriété",
    colors: ["#1A2D42", "#AAB7B7", "#2E4156", "#D4D8DD"],
  },
  prunelle: {
    label: "Prunelle",
    description: "Pourpre nocturne · Rose poudré · Crème",
    colors: ["#190019", "#854F6C", "#522B5B", "#FBE4D8"],
  },
  azurProfond: {
    label: "Azur Profond",
    description: "Bleu nuit · Ciel clair · Sérénité marine",
    colors: ["#021024", "#7DA0CA", "#052659", "#C1E8FF"],
  },
  auroreCorail: {
    label: "Aurore Corail",
    description: "Bleu mauve · Corail · Aube douce",
    colors: ["#2E365A", "#BD6C73", "#6B597F", "#92A1C2"],
  },
  braiseNocturne: {
    label: "Braise Nocturne",
    description: "Nuit profonde · Pêche braise · Rouge intense",
    colors: ["#161522", "#FFA586", "#384358", "#B51A2B"],
  },
  // ─── Variantes Bento (style mesh-gradient + glassmorphism) ───
  bentoDunesCuivre: {
    label: "Bento Dunes Cuivre",
    description: "Bleu nuit · Cuivre · Glassmorphism Bento",
    colors: ["#10232A", "#B58863", "#3D4D55", "#D3C3B9"],
  },
  bentoCrepuscule: {
    label: "Bento Crépuscule",
    description: "Bleu nuit · Corail · Glassmorphism Bento",
    colors: ["#03122F", "#F1916D", "#413B61", "#F3DADF"],
  },
  bentoBrumeArdoise: {
    label: "Bento Brume Ardoise",
    description: "Ardoise profonde · Brume · Glassmorphism Bento",
    colors: ["#1A2D42", "#AAB7B7", "#2E4156", "#D4D8DD"],
  },
  bentoPrunelle: {
    label: "Bento Prunelle",
    description: "Pourpre nocturne · Mauve · Glassmorphism Bento",
    colors: ["#190019", "#854F6C", "#522B5B", "#FBE4D8"],
  },
  bentoAzurProfond: {
    label: "Bento Azur Profond",
    description: "Bleu nuit · Ciel clair · Glassmorphism Bento",
    colors: ["#021024", "#7DA0CA", "#052659", "#C1E8FF"],
  },
  bentoAuroreCorail: {
    label: "Bento Aurore Corail",
    description: "Bleu mauve · Corail · Glassmorphism Bento",
    colors: ["#2E365A", "#BD6C73", "#6B597F", "#92A1C2"],
  },
  bentoBraiseNocturne: {
    label: "Bento Braise Nocturne",
    description: "Nuit profonde · Pêche braise · Glassmorphism Bento",
    colors: ["#161522", "#FFA586", "#384358", "#B51A2B"],
  },
  // ─── Variantes Neumorphism (Soft UI) ───
  nmDunesCuivre: {
    label: "Soft Dunes Cuivre",
    description: "Soft UI · Sable cuivré · Doux & minéral",
    colors: ["#E0D5C8", "#B58863", "#B5A998", "#FFFFFF"],
  },
  nmCrepuscule: {
    label: "Soft Crépuscule",
    description: "Soft UI · Lavande poudrée · Corail tendre",
    colors: ["#F3DADF", "#F1916D", "#D5B8BD", "#FFFFFF"],
  },
  nmBrumeArdoise: {
    label: "Soft Brume Ardoise",
    description: "Soft UI · Ardoise claire · Sobre & apaisé",
    colors: ["#D4D8DD", "#2E4156", "#B0B5BB", "#FFFFFF"],
  },
  nmPrunelle: {
    label: "Soft Prunelle",
    description: "Soft UI · Crème chaud · Mauve velours",
    colors: ["#FBE4D8", "#854F6C", "#DDC4B5", "#FFFFFF"],
  },
  nmAzurProfond: {
    label: "Soft Azur Profond",
    description: "Soft UI · Ciel pâle · Bleu marine",
    colors: ["#D8EBF7", "#5483B3", "#A8C5DA", "#FFFFFF"],
  },
  nmAuroreCorail: {
    label: "Soft Aurore Corail",
    description: "Soft UI · Mauve gris · Corail rosé",
    colors: ["#CFCFDC", "#BD6C73", "#A9A9B8", "#FFFFFF"],
  },
  nmBraiseNocturne: {
    label: "Soft Braise Nocturne",
    description: "Soft UI · Pêche pastel · Rouge braise",
    colors: ["#FFE0D2", "#B51A2B", "#E0BBA8", "#FFFFFF"],
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
    // Migrate away from removed legacy palettes
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
