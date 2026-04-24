/**
 * Test : persistance de l'opacité du TaskDetailPanel via localStorage,
 * et indépendance vis-à-vis des changements de palette Bento.
 *
 * Invariants vérifiés :
 *  1. ThemeContext lit `euthymia-task-panel-opacity` au démarrage et l'utilise
 *     comme valeur initiale (clampée entre 0.5 et 1).
 *  2. setTaskPanelOpacity persiste la valeur dans localStorage.
 *  3. setPalette ne modifie JAMAIS la clé `euthymia-task-panel-opacity`
 *     ni la variable CSS `--task-panel-bg-opacity`.
 *  4. Aucune règle CSS de palette (palettes.css) ne redéfinit
 *     `--task-panel-bg-opacity` (sinon le réglage utilisateur serait écrasé
 *     à chaque changement de thème).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const themeContextSrc = readFileSync(
  resolve(ROOT, "context/ThemeContext.tsx"),
  "utf-8",
);
const palettesCss = readFileSync(resolve(ROOT, "styles/palettes.css"), "utf-8");

describe("TaskDetailPanel — persistance de l'opacité", () => {
  it("lit la clé `euthymia-task-panel-opacity` depuis localStorage à l'init", () => {
    expect(themeContextSrc).toMatch(
      /localStorage\.getItem\(\s*["']euthymia-task-panel-opacity["']\s*\)/,
    );
  });

  it("clamp la valeur restaurée entre 0.5 et 1", () => {
    // La validation doit borner aux deux extrêmes.
    expect(themeContextSrc).toMatch(/parsed\s*>=\s*0\.5/);
    expect(themeContextSrc).toMatch(/parsed\s*<=\s*1/);
  });

  it("setTaskPanelOpacity écrit dans localStorage avec clamp", () => {
    expect(themeContextSrc).toMatch(
      /localStorage\.setItem\(\s*["']euthymia-task-panel-opacity["']/,
    );
    // Le setter clamp avant d'écrire.
    expect(themeContextSrc).toMatch(
      /Math\.min\(\s*1\s*,\s*Math\.max\(\s*0\.5/,
    );
  });

  it("setPalette ne touche jamais à l'opacité du panneau", () => {
    // Extrait le corps de setPalette
    const setPaletteMatch = themeContextSrc.match(
      /const\s+setPalette\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/,
    );
    expect(setPaletteMatch, "setPalette doit exister dans ThemeContext").toBeTruthy();
    const body = setPaletteMatch![1];
    expect(body).not.toMatch(/task-panel-bg-opacity/);
    expect(body).not.toMatch(/taskPanelOpacity/i);
    expect(body).not.toMatch(/euthymia-task-panel-opacity/);
  });

  it("l'effet qui pousse --task-panel-bg-opacity dépend uniquement de taskPanelOpacity", () => {
    // Cherche un useEffect qui setProperty('--task-panel-bg-opacity', ...)
    // et vérifie sa liste de dépendances.
    const re =
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?--task-panel-bg-opacity[\s\S]*?\},\s*\[([^\]]*)\]\s*\)/;
    const m = themeContextSrc.match(re);
    expect(
      m,
      "Un useEffect doit propager --task-panel-bg-opacity sur :root",
    ).toBeTruthy();
    const deps = m![1].trim();
    expect(deps).toBe("taskPanelOpacity");
  });
});

describe("Palettes CSS — non-écrasement de --task-panel-bg-opacity", () => {
  it("aucune règle de palette ne (re)définit --task-panel-bg-opacity", () => {
    // Toute occurrence doit être en LECTURE seule (var(--task-panel-bg-opacity[, fallback])).
    const lines = palettesCss.split("\n");
    const offenders: { line: number; text: string }[] = [];
    lines.forEach((text, i) => {
      // Définition = "--task-panel-bg-opacity:" hors d'un appel var(...)
      if (/--task-panel-bg-opacity\s*:/.test(text)) {
        offenders.push({ line: i + 1, text: text.trim() });
      }
    });
    if (offenders.length > 0) {
      throw new Error(
        "Des règles de palettes redéfinissent --task-panel-bg-opacity, " +
          "ce qui écraserait le réglage utilisateur restauré depuis localStorage :\n" +
          offenders.map((o) => `  L${o.line}: ${o.text}`).join("\n"),
      );
    }
    expect(offenders.length).toBe(0);
  });

  it("au moins une palette Bento consomme --task-panel-bg-opacity (lecture)", () => {
    expect(palettesCss).toMatch(/var\(\s*--task-panel-bg-opacity/);
  });
});
