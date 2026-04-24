/**
 * Test automatique WCAG : vérifie le ratio de contraste texte/arrière-plan
 * pour chaque palette définie dans src/styles/palettes.css.
 *
 * Seuils WCAG :
 *  - AA texte normal : 4.5:1
 *  - AA grand texte / UI : 3.0:1
 *
 * Les paires UI (muted, accent, sidebar) sont vérifiées au seuil 3.0,
 * les paires de lecture principale (background/foreground, card, popover,
 * primary, secondary) sont vérifiées au seuil 4.5.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Utilitaires couleur ───────────────────────────────────────────────

function parseHsl(value: string): [number, number, number] | null {
  // Format attendu : "260 12% 5%" ou "260, 12%, 5%"
  const cleaned = value.trim().replace(/,/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]);
  const l = parseFloat(parts[2]);
  if ([h, s, l].some(Number.isNaN)) return null;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (0 <= hp && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (1 <= hp && hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (2 <= hp && hp < 3) [r1, g1, b1] = [0, c, x];
  else if (3 <= hp && hp < 4) [r1, g1, b1] = [0, x, c];
  else if (4 <= hp && hp < 5) [r1, g1, b1] = [x, 0, c];
  else if (5 <= hp && hp < 6) [r1, g1, b1] = [c, 0, x];
  const m = lN - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// ─── Extraction des palettes depuis le CSS ─────────────────────────────

interface ParsedPalette {
  name: string;
  vars: Record<string, string>;
}

function extractPalettes(css: string): ParsedPalette[] {
  const palettes: ParsedPalette[] = [];
  const blockRegex = /\[data-palette="([^"]+)"\]\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(css)) !== null) {
    const name = match[1];
    const body = match[2];
    const vars: Record<string, string> = {};
    const varRegex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
    let varMatch: RegExpExecArray | null;
    while ((varMatch = varRegex.exec(body)) !== null) {
      vars[varMatch[1]] = varMatch[2].trim();
    }
    // Une palette « complète » doit fournir au minimum background + foreground en HSL
    if (vars["--background"] && vars["--foreground"]) {
      // Fusionner les définitions multiples (ex: light puis dark) en gardant la dernière
      const existing = palettes.find((p) => p.name === name);
      if (existing) {
        Object.assign(existing.vars, vars);
      } else {
        palettes.push({ name, vars });
      }
    }
  }
  return palettes;
}

function ratioFor(
  palette: ParsedPalette,
  fgVar: string,
  bgVar: string,
): number | null {
  const fgRaw = palette.vars[fgVar];
  const bgRaw = palette.vars[bgVar];
  if (!fgRaw || !bgRaw) return null;
  const fgHsl = parseHsl(fgRaw);
  const bgHsl = parseHsl(bgRaw);
  if (!fgHsl || !bgHsl) return null;
  return contrastRatio(hslToRgb(...fgHsl), hslToRgb(...bgHsl));
}

// ─── Définition des paires à auditer ───────────────────────────────────

interface Pair {
  fg: string;
  bg: string;
  threshold: number;
  label: string;
}

const PAIRS: Pair[] = [
  // Lecture principale — AA 4.5:1
  { fg: "--foreground", bg: "--background", threshold: 4.5, label: "body text" },
  { fg: "--card-foreground", bg: "--card", threshold: 4.5, label: "card" },
  { fg: "--popover-foreground", bg: "--popover", threshold: 4.5, label: "popover" },
  { fg: "--primary-foreground", bg: "--primary", threshold: 4.5, label: "primary button" },
  { fg: "--secondary-foreground", bg: "--secondary", threshold: 4.5, label: "secondary" },
  { fg: "--destructive-foreground", bg: "--destructive", threshold: 4.5, label: "destructive" },
  // UI / decoratif — AA 3.0:1
  { fg: "--muted-foreground", bg: "--background", threshold: 3.0, label: "muted text on bg" },
  { fg: "--muted-foreground", bg: "--muted", threshold: 3.0, label: "muted text on muted" },
  { fg: "--accent-foreground", bg: "--accent", threshold: 3.0, label: "accent" },
  { fg: "--sidebar-foreground", bg: "--sidebar-background", threshold: 3.0, label: "sidebar" },
];

// ─── Tests ────────────────────────────────────────────────────────────

const cssPath = resolve(__dirname, "../styles/palettes.css");
const css = readFileSync(cssPath, "utf-8");
const palettes = extractPalettes(css);

describe("WCAG contrast — palettes globales", () => {
  it("doit détecter au moins une palette dans palettes.css", () => {
    expect(palettes.length).toBeGreaterThan(0);
  });

  for (const palette of palettes) {
    describe(`palette "${palette.name}"`, () => {
      for (const pair of PAIRS) {
        // On ne teste que les paires dont les deux variables existent dans la palette
        const fgPresent = pair.fg in palette.vars;
        const bgPresent = pair.bg in palette.vars;
        if (!fgPresent || !bgPresent) continue;

        it(`${pair.label} (${pair.fg} sur ${pair.bg}) ≥ ${pair.threshold}:1`, () => {
          const ratio = ratioFor(palette, pair.fg, pair.bg);
          expect(ratio).not.toBeNull();
          if (ratio !== null && ratio < pair.threshold) {
            // Message explicite pour faciliter le debug en CI
            throw new Error(
              `Palette "${palette.name}" — ${pair.label} : ratio ${ratio.toFixed(
                2,
              )}:1 < ${pair.threshold}:1 (fg=${palette.vars[pair.fg]}, bg=${
                palette.vars[pair.bg]
              })`,
            );
          }
          expect(ratio!).toBeGreaterThanOrEqual(pair.threshold);
        });
      }
    });
  }
});
