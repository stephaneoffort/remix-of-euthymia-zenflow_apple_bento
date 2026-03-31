import React from 'react';
import { Check, Palette, Sun, Moon, Blend } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useThemeMode, PALETTE_META, type ThemePalette, type ThemeMode } from '@/context/ThemeContext';
import { toast } from 'sonner';

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { key: 'light', label: 'Clair', icon: <Sun className="w-4 h-4" /> },
  { key: 'dark', label: 'Sombre', icon: <Moon className="w-4 h-4" /> },
  { key: 'mixed', label: 'Mixte', icon: <Blend className="w-4 h-4" /> },
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
    toast.success(`Mode ${MODE_OPTIONS.find(m => m.key === mode)?.label} activé`);
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
          <p className="text-sm text-muted-foreground">
            Clair, sombre ou mixte (contenu clair + sidebar sombre).
          </p>
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
                      ? 'border-primary bg-accent/40 text-foreground shadow-md'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/30'
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
          <p className="text-sm text-muted-foreground">
            Choisissez votre identité visuelle. Ce choix est personnel.
          </p>
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
                      ? 'border-primary bg-accent/40 shadow-md'
                      : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
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
