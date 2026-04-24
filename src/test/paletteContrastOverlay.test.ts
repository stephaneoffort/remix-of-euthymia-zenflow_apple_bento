/**
 * Test WCAG — overlays & dégradés
 *
 * Les modes Bento (et certains thèmes glass) superposent à la palette de
 * base des surfaces semi-transparentes (`bento-cell` rgba) et des halos
 * radiaux (`bento-hero-glow`). Un texte au-dessus d'une telle surface
 * compose visuellement avec :
 *   1. Le fond de page (`--background`)
 *   2. Une couche overlay rgba (la cellule)
 *   3. Optionnellement un dégradé radial coloré (le glow)
 *
 * Ce test simule plusieurs échantillons (centre du glow, bord du glow,
 * hors-glow) pour chaque palette concernée et vérifie que le texte
 * (`--card-foreground`) reste lisible au seuil WCAG AA correspondant.
 *
 * Seuils :
 *  - Texte de lecture : 4.5:1
 *  - Surfaces hero / overlays décoratifs : 3.0:1 (texte large / UI)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Couleurs ──────────────────────────────────────────────────────────

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

function parseHsl(value: string): [number, number, number] | null {
  const cleaned = value.trim().replace(/,/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]);
  const l = parseFloat(parts[2]);
  if ([h, s, l].some(Number.isNaN)) return null;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
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

function relLuminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Compose une couche RGBA au-dessus d'un fond opaque (alpha blending). */
function composite(over: Rgba, under: Rgb): Rgb {
  const [r1, g1, b1, a] = over;
  const [r2, g2, b2] = under;
  return [r1 * a + r2 * (1 - a), g1 * a + g2 * (1 - a), b1 * a + b2 * (1 - a)];
}

function parseRgba(value: string): Rgba | null {
  // rgba(168,213,181,0.06) | rgb(168, 213, 181)
  const m = value.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i,
  );
  if (!m) return null;
  return [
    parseInt(m[1], 10),
    parseInt(m[2], 10),
    parseInt(m[3], 10),
    m[4] !== undefined ? parseFloat(m[4]) : 1,
  ];
}

// ─── Extraction palettes + overlays ────────────────────────────────────

interface ParsedPalette {
  name: string;
  vars: Record<string, string>;
  /** rgba de bento-bg / bento-bg-hover */
  bentoBg?: Rgba;
  bentoBgHover?: Rgba;
  /** Premier color stop d'un radial-gradient (hero-glow) */
  glowStop?: Rgba;
}

function extractAll(css: string): ParsedPalette[] {
  const palettes = new Map<string, ParsedPalette>();

  // 1) Variables HSL par palette (on fusionne toutes les variantes)
  const blockRegex = /\[data-palette="([^"]+)"\][^{]*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(css)) !== null) {
    const name = match[1];
    const body = match[2];
    let p = palettes.get(name);
    if (!p) {
      p = { name, vars: {} };
      palettes.set(name, p);
    }
    const varRegex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
    let vm: RegExpExecArray | null;
    while ((vm = varRegex.exec(body)) !== null) {
      const key = vm[1];
      const val = vm[2].trim();
      p.vars[key] = val;
      if (key === "--bento-bg") {
        const rgba = parseRgba(val);
        if (rgba) p.bentoBg = rgba;
      } else if (key === "--bento-bg-hover") {
        const rgba = parseRgba(val);
        if (rgba) p.bentoBgHover = rgba;
      }
    }
  }

  // 2) Premier color stop des radial-gradient hero-glow
  const glowRegex =
    /\[data-palette="([^"]+)"\][^{]*\.bento-hero-glow[^{]*\{[^}]*radial-gradient\([^)]*?(rgba?\([^)]+\))/g;
  let gm: RegExpExecArray | null;
  while ((gm = glowRegex.exec(css)) !== null) {
    const name = gm[1];
    const p = palettes.get(name);
    if (!p) continue;
    const rgba = parseRgba(gm[2]);
    if (rgba && !p.glowStop) p.glowStop = rgba;
  }

  return Array.from(palettes.values());
}

// ─── Tests ────────────────────────────────────────────────────────────

const cssPath = resolve(__dirname, "../styles/palettes.css");
const css = readFileSync(cssPath, "utf-8");
const palettes = extractAll(css);

/** Palettes "bento" : où les overlays sont vraiment utilisés. */
const BENTO_PALETTES = palettes.filter((p) => p.name.startsWith("bento"));

describe("WCAG contrast — overlays & dégradés bento", () => {
  it("doit détecter les palettes bento dans palettes.css", () => {
    expect(BENTO_PALETTES.length).toBeGreaterThan(0);
  });

  for (const palette of BENTO_PALETTES) {
    describe(`palette "${palette.name}"`, () => {
      const bgRaw = palette.vars["--background"];
      const fgRaw = palette.vars["--card-foreground"] ?? palette.vars["--foreground"];
      if (!bgRaw || !fgRaw) {
        it.skip("variables manquantes", () => {});
        return;
      }
      const bgHsl = parseHsl(bgRaw);
      const fgHsl = parseHsl(fgRaw);
      if (!bgHsl || !fgHsl) {
        it.skip("variables HSL invalides", () => {});
        return;
      }
      const bgRgb = hslToRgb(...bgHsl);
      const fgRgb = hslToRgb(...fgHsl);

      // ─── Échantillon 1 : texte directement sur le fond de page ───
      it("texte sur fond de page nu ≥ 4.5:1", () => {
        const ratio = contrastRatio(fgRgb, bgRgb);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      // ─── Échantillon 2 : texte sur bento-cell (overlay rgba sur bg) ───
      if (palette.bentoBg && palette.bentoBg[3] > 0) {
        it("texte sur bento-cell (overlay) ≥ 4.5:1", () => {
          const composed = composite(palette.bentoBg!, bgRgb);
          const ratio = contrastRatio(fgRgb, composed);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
      }

      // ─── Échantillon 3 : texte sur bento-cell:hover (overlay un peu plus marqué) ───
      if (palette.bentoBgHover) {
        it("texte sur bento-cell:hover ≥ 4.5:1", () => {
          const composed = composite(palette.bentoBgHover!, bgRgb);
          const ratio = contrastRatio(fgRgb, composed);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
      }

      // ─── Échantillon 4 : texte sur bord du glow (alpha ≈ 50% de la couleur) ───
      if (palette.glowStop) {
        // Au bord du gradient l'alpha effectif du stop est divisé (~moitié)
        const edge: Rgba = [
          palette.glowStop[0],
          palette.glowStop[1],
          palette.glowStop[2],
          palette.glowStop[3] * 0.5,
        ];
        it("texte sur bord du hero-glow ≥ 3.0:1 (large/UI)", () => {
          const composed = composite(edge, bgRgb);
          const ratio = contrastRatio(fgRgb, composed);
          expect(ratio).toBeGreaterThanOrEqual(3.0);
        });

        // ─── Échantillon 5 : texte au centre du glow (alpha pleine intensité) ───
        it("texte au centre du hero-glow ≥ 3.0:1 (large/UI)", () => {
          const composed = composite(palette.glowStop!, bgRgb);
          const ratio = contrastRatio(fgRgb, composed);
          if (ratio < 3.0) {
            throw new Error(
              `Palette "${palette.name}" : ratio centre-glow ${ratio.toFixed(
                2,
              )}:1 < 3.0:1 (glow=${JSON.stringify(palette.glowStop)})`,
            );
          }
          expect(ratio).toBeGreaterThanOrEqual(3.0);
        });
      }

      // ─── Échantillon 6 : double couche (cell + glow par-dessus) ───
      if (palette.bentoBg && palette.glowStop) {
        it("texte sur bento-cell + hero-glow ≥ 3.0:1", () => {
          const cellOnBg = composite(palette.bentoBg!, bgRgb);
          const finalBg = composite(palette.glowStop!, cellOnBg);
          const ratio = contrastRatio(fgRgb, finalBg);
          expect(ratio).toBeGreaterThanOrEqual(3.0);
        });
      }
    });
  }
});
