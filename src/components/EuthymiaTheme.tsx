import React from "react";
import { Check, Palette, Sun, Moon, Blend } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useThemeMode, PALETTE_META, type ThemePalette, type ThemeMode } from "@/context/ThemeContext";
import { toast } from "sonner";

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { key: "light", label: "Clair", icon: <Sun className="w-4 h-4" /> },
  { key: "dark", label: "Sombre", icon: <Moon className="w-4 h-4" /> },
  { key: "mixed", label: "Mixte", icon: <Blend className="w-4 h-4" /> },
];

export default function EuthymiaTheme() {
  const { theme, setTheme, palette, setPalette } = useThemeMode();
  const palettes = Object.entries(PALETTE_META) as [ThemePalette, (typeof PALETTE_META)[ThemePalette]][];

  const handleSelectPalette = (key: ThemePalette) => {
    if (key === palette) return;
    setPalette(key);
    toast.success(`Palette "${PALETTE_META[key].label}" appliquée`);
  };

  const handleSelectMode = (mode: ThemeMode) => {
    if (mode === theme) return;
    setTheme(mode);
    toast.success(`Mode ${MODE_OPTIONS.find((m) => m.key === mode)?.label} activé`);
  };

  return (
    <div className="space-y-6">
      {/* ── Mode clair / sombre / mixte ── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Sun className="w-5 h-5 text-primary" />
            Mode d'affichage
          </CardTitle>
          <p className="text-sm text-muted-foreground">Clair, sombre ou mixte (contenu clair + sidebar sombre).</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {MODE_OPTIONS.map(({ key, label, icon }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectMode(key)}
                  className={`relative flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    active
                      ? "border-primary bg-accent/40 text-foreground shadow-md"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  {icon}
                  {label}
                  {active && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Sélection de palette ── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Palette className="w-5 h-5 text-primary" />
            Palette de couleurs
          </CardTitle>
          <p className="text-sm text-muted-foreground">Choisissez votre identité visuelle. Ce choix est personnel.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {palettes.map(([key, meta]) => {
              const active = palette === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectPalette(key)}
                  className={`group relative flex flex-col gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                    active
                      ? "border-primary bg-accent/40 shadow-md"
                      : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  {active && (
                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    </span>
                  )}
                  <div className="flex gap-1.5">
                    {meta.colors.map((c, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-lg border border-border/50"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
/**
 * EUTHYMIA — Thème Ivoire Chaud
 * Composant React avec tous les tokens neumorphiques
 * Compatible Lovable / Vite / React 18+
 *
 * Usage :
 *   import { NmTile, NmTileInset, NmBtn, NmBadge,
 *            NmProgress, NmAvatar, NmTag } from './EuthymiaTheme'
 */

import React from "react";

// ── STYLE HELPERS ──────────────────────────────────────────
const SH_DARK = "rgba(160,140,108,0.45)";
const SH_LIGHT = "rgba(255,252,246,0.85)";
const BG = "#EDE6DA";

export const nm = {
  bg: BG,
  accent: "#B87440",
  success: "#6B8F6A",
  danger: "#B85040",
  warning: "#C4A040",
  textPri: "#2D2820",
  textSec: "#8A7E6E",
  textMuted: "#B0A494",

  raised: `6px 6px 14px ${SH_DARK}, -6px -6px 14px ${SH_LIGHT}`,
  raisedSm: `3px 3px 8px ${SH_DARK}, -3px -3px 8px ${SH_LIGHT}`,
  raisedXs: `2px 2px 5px ${SH_DARK}, -2px -2px 5px ${SH_LIGHT}`,
  inset: `inset 4px 4px 10px ${SH_DARK}, inset -4px -4px 10px ${SH_LIGHT}`,
  insetSm: `inset 2px 2px 6px ${SH_DARK}, inset -2px -2px 6px ${SH_LIGHT}`,
  insetXs: `inset 1px 1px 4px ${SH_DARK}, inset -1px -1px 4px ${SH_LIGHT}`,

  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUi: "'DM Sans', system-ui, sans-serif",

  radius: { xl: 20, lg: 16, md: 12, sm: 8, pill: 100 },
};

// ── COMPOSANTS ────────────────────────────────────────────

/**
 * Tuile raised — surface extrudée
 * Usage : <NmTile style={{ padding: 20 }}>...</NmTile>
 */
export function NmTile({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: nm.bg,
        borderRadius: nm.radius.lg,
        boxShadow: nm.raised,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Tuile inset — surface enfoncée
 * Usage : <NmTileInset>...</NmTileInset>
 */
export function NmTileInset({ children, style }) {
  return (
    <div
      style={{
        background: nm.bg,
        borderRadius: nm.radius.lg,
        boxShadow: nm.inset,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Bouton neumorphique
 * variant: 'default' | 'accent'
 */
export function NmBtn({ children, onClick, variant = "default", style }) {
  const [pressed, setPressed] = React.useState(false);

  const baseStyle = {
    background: nm.bg,
    border: "none",
    borderRadius: nm.radius.sm,
    color: nm.textPri,
    cursor: "pointer",
    fontFamily: nm.fontUi,
    fontSize: 13,
    fontWeight: 500,
    padding: "10px 18px",
    transition: "box-shadow 0.15s ease, transform 0.1s ease",
    boxShadow: pressed ? nm.insetSm : nm.raisedSm,
    transform: pressed ? "scale(0.98)" : "scale(1)",
    ...style,
  };

  if (variant === "accent") {
    baseStyle.background = nm.accent;
    baseStyle.color = "#FFF8F0";
    baseStyle.boxShadow = pressed
      ? `inset 3px 3px 8px rgba(140,80,20,0.5), inset -2px -2px 6px rgba(255,220,160,0.2)`
      : `4px 4px 10px rgba(160,100,40,0.4), -2px -2px 8px rgba(255,240,210,0.3)`;
  }

  return (
    <button
      style={baseStyle}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

/**
 * Badge pill raised
 * variant: 'default' | 'accent' | 'danger' | 'success'
 */
export function NmBadge({ children, variant = "default", style }) {
  const colors = {
    default: nm.textSec,
    accent: nm.accent,
    danger: nm.danger,
    success: nm.success,
  };
  return (
    <span
      style={{
        background: nm.bg,
        borderRadius: 100,
        boxShadow: nm.raisedXs,
        color: colors[variant],
        display: "inline-block",
        fontFamily: nm.fontUi,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.3px",
        padding: "3px 9px",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Tag statut (petite étiquette)
 */
export function NmTag({ children, variant = "default" }) {
  const colors = {
    default: nm.textSec,
    danger: nm.danger,
    accent: nm.accent,
    success: nm.success,
  };
  return (
    <span
      style={{
        background: nm.bg,
        borderRadius: 4,
        boxShadow: nm.raisedXs,
        color: colors[variant],
        display: "inline-block",
        fontSize: 9,
        fontWeight: 500,
        padding: "2px 6px",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Avatar initiales
 */
export function NmAvatar({ initials, color = nm.accent, size = 32 }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: nm.bg,
        borderRadius: "50%",
        boxShadow: nm.raisedSm,
        color,
        display: "flex",
        flexShrink: 0,
        fontSize: size * 0.28,
        fontWeight: 500,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {initials}
    </div>
  );
}

/**
 * Barre de progression
 */
export function NmProgress({ value = 0, max = 100, color = nm.success }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div
        style={{
          background: nm.bg,
          borderRadius: 4,
          boxShadow: nm.insetXs,
          height: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: color,
            borderRadius: 4,
            height: "100%",
            transition: "width 0.6s ease",
            width: `${pct}%`,
          }}
        />
      </div>
      <div
        style={{
          color: nm.textMuted,
          display: "flex",
          fontSize: 9,
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <span>0</span>
        <span>{pct}%</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/**
 * Input neumorphique
 */
export function NmInput({ placeholder, value, onChange, style }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: nm.bg,
        border: "none",
        borderRadius: nm.radius.sm,
        boxShadow: focused ? `${nm.inset}, 0 0 0 2px rgba(184,116,64,0.2)` : nm.insetSm,
        color: nm.textPri,
        fontFamily: nm.fontUi,
        fontSize: 13,
        outline: "none",
        padding: "10px 14px",
        transition: "box-shadow 0.2s ease",
        width: "100%",
        ...style,
      }}
    />
  );
}

/**
 * Titre display (Cormorant Garamond)
 * size: 'xl' (48px) | 'lg' (38px) | 'md' (28px) | 'sm' (20px)
 */
export function NmDisplay({ children, size = "lg", style }) {
  const sizes = { xl: 48, lg: 38, md: 28, sm: 20 };
  return (
    <div
      style={{
        fontFamily: nm.fontDisplay,
        fontSize: sizes[size],
        fontWeight: 300,
        letterSpacing: "-0.5px",
        lineHeight: 1.05,
        color: nm.textPri,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Stat numérique large
 */
export function NmStat({ value, label }) {
  return (
    <div>
      <div
        style={{
          fontFamily: nm.fontDisplay,
          fontSize: 46,
          fontWeight: 300,
          letterSpacing: "-2px",
          lineHeight: 1,
          color: nm.textPri,
        }}
      >
        {value}
      </div>
      {label && (
        <div
          style={{
            fontSize: 9,
            color: nm.textMuted,
            letterSpacing: "0.5px",
            marginTop: 3,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * Label section (uppercase muted)
 */
export function NmLabel({ children }) {
  return (
    <div
      style={{
        color: nm.textSec,
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Wrapper app global
 * À placer autour de tout votre layout
 */
export function NmApp({ children }) {
  return (
    <div
      style={{
        background: nm.bg,
        color: nm.textPri,
        fontFamily: nm.fontUi,
        minHeight: "100vh",
      }}
    >
      {children}
    </div>
  );
}
