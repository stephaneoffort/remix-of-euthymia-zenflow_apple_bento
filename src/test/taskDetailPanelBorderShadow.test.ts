/**
 * Test : bordures & ombres du TaskDetailPanel en mode Bento.
 *
 * Garanties vérifiées :
 *  1. Le conteneur racine de TaskDetailPanel utilise les classes opaques
 *     `border-border` et `shadow-xl`, et n'introduit AUCUNE classe Tailwind
 *     translucide (`border-*/<n>`, `bg-*/<n>`, `shadow-none`, `border-transparent`)
 *     qui laisserait passer le mesh-gradient Bento.
 *  2. Pour chaque palette `bento*` (default/light/mixed/dark), la variable
 *     CSS `--border` (consommée par `border-border`) est définie en HSL
 *     opaque — jamais `transparent`, jamais une rgba/hsla avec alpha < 1.
 *  3. Aucune palette Bento ne neutralise `.shadow-xl` (ou ne le redéfinit
 *     avec un alpha global ≤ 0) au point de rendre l'ombre invisible :
 *     l'ombre matérialise visuellement la séparation du panneau.
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

// ─── Helpers ───────────────────────────────────────────────────────────

/** Extrait la liste de classes du conteneur racine task-detail-panel. */
function extractRootClasses(src: string): string {
  // On capture la valeur de className contenant `task-detail-panel`.
  // Supporte className="..." et className={`...${expr}...`}
  const re =
    /className=\{?`([^`]*\btask-detail-panel\b[^`]*)`|className="([^"]*\btask-detail-panel\b[^"]*)"/;
  const m = src.match(re);
  if (!m) {
    throw new Error(
      "Impossible de localiser le conteneur racine `task-detail-panel` dans TaskDetailPanel.tsx",
    );
  }
  return (m[1] ?? m[2] ?? "").trim();
}

/** Détecte les classes Tailwind qui introduisent de la transparence. */
function findTranslucentClasses(classes: string): string[] {
  const tokens = classes.split(/\s+/);
  const offenders: string[] = [];
  for (const t of tokens) {
    // bg-*/N, border-*/N, shadow-*/N (modificateur d'opacité Tailwind)
    if (/^(bg|border|shadow|ring|divide)-[a-z0-9-]+\/[0-9]+$/i.test(t)) {
      offenders.push(t);
      continue;
    }
    // bg-transparent / border-transparent sur le conteneur racine
    if (t === "bg-transparent" || t === "border-transparent") {
      offenders.push(t);
      continue;
    }
    // shadow-none désactiverait la séparation visuelle
    if (t === "shadow-none") {
      offenders.push(t);
    }
  }
  return offenders;
}

/** Vérifie qu'une valeur CSS est opaque (HSL nu, ou alpha === 1). */
function isOpaqueColor(value: string): { ok: boolean; reason?: string } {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return { ok: false, reason: "valeur `transparent`" };
  if (v === "none") return { ok: false, reason: "valeur `none`" };

  // rgba(r,g,b,a) / hsla(h,s,l,a) avec a < 1
  const legacyAlpha = v.match(/(?:rgba|hsla)\s*\([^)]*?,\s*([\d.]+)\s*\)/);
  if (legacyAlpha) {
    const alpha = parseFloat(legacyAlpha[1]);
    if (!Number.isNaN(alpha) && alpha < 1) {
      return { ok: false, reason: `alpha = ${alpha} (< 1)` };
    }
  }

  // Notation moderne rgb(... / 0.5) ou hsl(... / 50%)
  const slashAlpha = v.match(/\/\s*([\d.]+%?)\s*\)/);
  if (slashAlpha) {
    const raw = slashAlpha[1];
    const alpha = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    if (!Number.isNaN(alpha) && alpha < 1) {
      return { ok: false, reason: `alpha = ${alpha} (< 1)` };
    }
  }
  return { ok: true };
}

interface BentoBlock {
  selector: string;
  palette: string;
  variant: string;
  body: string;
}

/** Récupère tous les blocs CSS dont le sélecteur cible une palette bento*. */
function extractBentoBlocks(css: string): BentoBlock[] {
  const out: BentoBlock[] = [];
  const re = /(\[data-palette="(bento[A-Za-z0-9]+)"\][^{]*)\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim();
    const palette = m[2];
    const body = m[3];
    let variant = "default";
    if (selector.includes(".light")) variant = "light";
    else if (selector.includes(".mixed")) variant = "mixed";
    else if (selector.includes(".dark")) variant = "dark";
    out.push({ selector, palette, variant, body });
  }
  return out;
}

// ─── 1. Conteneur racine : pas de classes translucides ─────────────────

describe("TaskDetailPanel — bordures & ombres opaques", () => {
  const rootClasses = extractRootClasses(panelSource);

  it("utilise `border-border` (token HSL opaque) sur la racine", () => {
    expect(rootClasses).toMatch(/\bborder-border\b/);
  });

  it("utilise `shadow-xl` (Tailwind statique) sur la racine", () => {
    expect(rootClasses).toMatch(/\bshadow-xl\b/);
  });

  it("n'introduit aucune classe Tailwind translucide sur la racine", () => {
    const offenders = findTranslucentClasses(rootClasses);
    if (offenders.length > 0) {
      throw new Error(
        `Le conteneur racine TaskDetailPanel utilise des classes translucides : ${offenders.join(
          ", ",
        )}. Ces classes laisseraient le mesh-gradient Bento traverser la bordure / l'ombre.`,
      );
    }
    expect(offenders).toEqual([]);
  });
});

// ─── 2. --border opaque pour chaque palette Bento ──────────────────────

describe("Palettes Bento — --border (border-border) opaque", () => {
  const blocks = extractBentoBlocks(palettesCss);
  // On ne garde que les blocs qui définissent --background ET --border
  // (= les blocs racine de palette, pas les sous-règles .bento-cell, etc.)
  const rootBlocks = blocks.filter(
    (b) => /--background\s*:/.test(b.body) && /--border\s*:/.test(b.body),
  );

  it("doit détecter au moins une palette Bento racine", () => {
    expect(rootBlocks.length).toBeGreaterThan(0);
  });

  for (const b of rootBlocks) {
    it(`${b.palette} (${b.variant}) → --border opaque`, () => {
      const m = b.body.match(/--border\s*:\s*([^;]+);/);
      expect(m).not.toBeNull();
      const value = m![1].trim();
      const result = isOpaqueColor(value);
      if (!result.ok) {
        throw new Error(
          `Palette "${b.palette}" variante "${b.variant}" : --border non opaque ` +
            `(${result.reason}). Valeur actuelle : "${value}". ` +
            `La bordure du TaskDetailPanel (border-border) doit rester pleinement ` +
            `opaque pour matérialiser visuellement le panneau.`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }
});

// ─── 3. Aucune palette Bento ne neutralise .shadow-xl ──────────────────

describe("Palettes Bento — .shadow-xl non neutralisé", () => {
  // On cherche d'éventuelles règles `.shadow-xl { box-shadow: none|transparent|alpha=0 }`
  // scopées à une palette bento.
  const re =
    /\[data-palette="(bento[A-Za-z0-9]+)"\][^{]*\.shadow-xl[^{]*\{([^}]+)\}/g;

  const offenders: { palette: string; reason: string; rule: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(palettesCss)) !== null) {
    const palette = m[1];
    const body = m[2];
    const boxShadow = body.match(/box-shadow\s*:\s*([^;]+);/i);
    if (!boxShadow) continue;
    const value = boxShadow[1].trim().toLowerCase();
    if (value === "none") {
      offenders.push({ palette, reason: "box-shadow: none", rule: value });
      continue;
    }
    // Si toutes les couches de l'ombre ont un alpha = 0, l'ombre est invisible.
    const colorAlphas = [
      ...value.matchAll(/(?:rgba|hsla)\s*\([^)]*?,\s*([\d.]+)\s*\)/g),
    ].map((x) => parseFloat(x[1]));
    if (colorAlphas.length > 0 && colorAlphas.every((a) => a === 0)) {
      offenders.push({
        palette,
        reason: "toutes les couches d'ombre ont alpha = 0",
        rule: value,
      });
    }
  }

  it("aucune palette Bento ne désactive .shadow-xl", () => {
    if (offenders.length > 0) {
      const msg = offenders
        .map(
          (o) =>
            `  • ${o.palette} : ${o.reason} → "${o.rule}"`,
        )
        .join("\n");
      throw new Error(
        `Des palettes Bento neutralisent .shadow-xl, ce qui supprimerait la séparation visuelle du TaskDetailPanel :\n${msg}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
