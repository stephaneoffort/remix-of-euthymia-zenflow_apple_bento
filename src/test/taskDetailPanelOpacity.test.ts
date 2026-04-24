/**
 * Test : opacité du panneau de détail de tâche (TaskDetailPanel)
 * pour chaque palette Bento.
 *
 * Garanties vérifiées :
 *  1. Le composant TaskDetailPanel applique bien la classe `bg-background`
 *     sur son conteneur racine (sinon le mesh-gradient/orbes traversent
 *     le panneau et nuisent à la lisibilité).
 *  2. Pour chaque palette `bento*` et chacune de ses variantes
 *     (default/light/mixed), la variable CSS `--background` est définie
 *     en HSL OPAQUE — jamais `transparent`, jamais une rgba/hsla avec
 *     alpha < 1.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Lecture des sources ───────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const panelSource = readFileSync(
  resolve(ROOT, "components/TaskDetailPanel.tsx"),
  "utf-8",
);
const palettesCss = readFileSync(resolve(ROOT, "styles/palettes.css"), "utf-8");

// ─── 1. Le composant doit appliquer bg-background ──────────────────────

describe("TaskDetailPanel — opacité du panneau", () => {
  it("le conteneur racine applique la classe bg-background", () => {
    // On cherche la classe bg-background associée au wrapper racine
    // (caractérisé par border-l + task-detail-panel).
    const rootClassRegex =
      /className=\{?`?[^`"]*\bbg-background\b[^`"]*\btask-detail-panel\b/;
    const altRegex =
      /className=\{?`?[^`"]*\btask-detail-panel\b[^`"]*\bbg-background\b/;
    const hasBackground =
      rootClassRegex.test(panelSource) || altRegex.test(panelSource);

    if (!hasBackground) {
      throw new Error(
        "TaskDetailPanel : le conteneur racine doit inclure la classe Tailwind `bg-background` " +
          "afin de garantir un fond opaque dans tous les modes (notamment Bento où le body porte " +
          "un mesh-gradient).",
      );
    }
    expect(hasBackground).toBe(true);
  });
});

// ─── 2. Toutes les variantes de palettes Bento doivent avoir un --background opaque ───

interface PaletteVariant {
  /** Sélecteur CSS exact, ex. `[data-palette="bentoOcean"].light` */
  selector: string;
  /** Nom de la palette (ex. `bentoOcean`) */
  palette: string;
  /** Variante (`default`, `light`, `mixed`) */
  variant: string;
  /** Valeur de --background telle que déclarée */
  background: string;
}

function extractBentoBackgrounds(css: string): PaletteVariant[] {
  const out: PaletteVariant[] = [];
  // Capture toutes les règles ciblant data-palette="bento..." et leur corps
  const blockRegex =
    /(\[data-palette="(bento[A-Za-z0-9]+)"\][^{]*)\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(css)) !== null) {
    const selector = m[1].trim();
    const palette = m[2];
    const body = m[3];
    const bgMatch = body.match(/--background\s*:\s*([^;]+);/);
    if (!bgMatch) continue;
    let variant = "default";
    if (selector.includes(".light")) variant = "light";
    else if (selector.includes(".mixed")) variant = "mixed";
    else if (selector.includes(".dark")) variant = "dark";
    out.push({
      selector,
      palette,
      variant,
      background: bgMatch[1].trim(),
    });
  }
  return out;
}

/** Une valeur CSS de fond est-elle considérée comme opaque ? */
function isOpaqueBackground(value: string): {
  ok: boolean;
  reason?: string;
} {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return { ok: false, reason: "valeur `transparent`" };
  if (v === "none") return { ok: false, reason: "valeur `none`" };

  // rgba(...) ou hsla(...) avec alpha explicite < 1
  const alphaMatch = v.match(
    /(?:rgba|hsla)\s*\([^)]*?,\s*([\d.]+)\s*\)/,
  );
  if (alphaMatch) {
    const alpha = parseFloat(alphaMatch[1]);
    if (!Number.isNaN(alpha) && alpha < 1) {
      return { ok: false, reason: `alpha = ${alpha} (< 1)` };
    }
  }

  // Notation moderne `rgb(... / 0.5)` ou `hsl(... / 50%)`
  const slashAlpha = v.match(/\/\s*([\d.]+%?)\s*\)/);
  if (slashAlpha) {
    const raw = slashAlpha[1];
    const alpha = raw.endsWith("%")
      ? parseFloat(raw) / 100
      : parseFloat(raw);
    if (!Number.isNaN(alpha) && alpha < 1) {
      return { ok: false, reason: `alpha = ${alpha} (< 1)` };
    }
  }

  // Format HSL "H S% L%" attendu par Tailwind/shadcn → toujours opaque
  return { ok: true };
}

describe("Palettes Bento — variable --background opaque", () => {
  const variants = extractBentoBackgrounds(palettesCss);

  it("doit détecter au moins une variante Bento", () => {
    expect(variants.length).toBeGreaterThan(0);
  });

  for (const v of variants) {
    it(`${v.palette} (${v.variant}) → --background opaque`, () => {
      const result = isOpaqueBackground(v.background);
      if (!result.ok) {
        throw new Error(
          `Palette "${v.palette}" variante "${v.variant}" : --background non opaque ` +
            `(${result.reason}). Valeur actuelle : "${v.background}". ` +
            `Le panneau de détail (TaskDetailPanel) utilise bg-background et doit ` +
            `pouvoir s'appuyer sur une couleur de fond pleinement opaque.`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }
});
