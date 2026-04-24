/**
 * Test e2e (analyse statique des sources) :
 * Vérifie que le renommage « Ivoire » → « Premium » a bien été appliqué
 * dans toutes les surfaces visibles de l'interface :
 *   - PALETTE_META.ivoireChaud.label === "Premium Chaud"
 *   - Le switch design mode affiche "Premium" (et non "Ivoire") dans :
 *       · src/pages/Settings.tsx
 *       · src/components/SidebarNM.tsx
 *       · src/components/AppSidebar.tsx
 *   - Aucun libellé visible (chaîne entre guillemets) ne contient
 *     « Ivoire » dans ces trois fichiers.
 *
 * On évite tout rendu React (TSX) pour ne pas dépendre des contextes
 * lourds (Auth, App, Theme, Router) ni des types @testing-library/react
 * qui ne sont pas distribués dans node_modules.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PALETTE_META } from "@/context/ThemeContext";

const ROOT = resolve(__dirname, "..");

const settingsSrc = readFileSync(resolve(ROOT, "pages/Settings.tsx"), "utf-8");
const sidebarNmSrc = readFileSync(
  resolve(ROOT, "components/SidebarNM.tsx"),
  "utf-8",
);
const appSidebarSrc = readFileSync(
  resolve(ROOT, "components/AppSidebar.tsx"),
  "utf-8",
);

/** Extrait toutes les chaînes entre guillemets (visibles à l'utilisateur). */
function extractStringLiterals(source: string): string[] {
  const matches = source.match(/"[^"\n]*"|'[^'\n]*'/g) ?? [];
  return matches.map((s) => s.slice(1, -1));
}

describe("PALETTE_META — palette renommée Premium Chaud", () => {
  it("expose ivoireChaud avec le label « Premium Chaud »", () => {
    expect(PALETTE_META.ivoireChaud).toBeDefined();
    expect(PALETTE_META.ivoireChaud.label).toBe("Premium Chaud");
  });

  it("ne contient plus aucun label « Ivoire » dans toutes les palettes", () => {
    for (const meta of Object.values(PALETTE_META)) {
      expect(meta.label).not.toMatch(/Ivoire/i);
    }
  });
});

describe("Switch design mode — libellé « Premium »", () => {
  const files = [
    { name: "Settings.tsx", src: settingsSrc },
    { name: "SidebarNM.tsx", src: sidebarNmSrc },
    { name: "AppSidebar.tsx", src: appSidebarSrc },
  ];

  for (const { name, src } of files) {
    it(`${name} : affiche « Premium » (et non « Ivoire ») dans les libellés visibles`, () => {
      const literals = extractStringLiterals(src);

      // On ignore les identifiants techniques en camelCase (ex: "ivoireChaud")
      // qui restent comme clés de palette mais ne sont jamais affichés.
      const TECH_IDS = new Set(["ivoireChaud"]);
      const visibleIvoire = literals.filter(
        (s) => /Ivoire/i.test(s) && !TECH_IDS.has(s),
      );
      expect(
        visibleIvoire,
        `Libellés visibles contenant « Ivoire » à supprimer : ${JSON.stringify(visibleIvoire)}`,
      ).toEqual([]);

      const hasPremium = literals.some((s) => /Premium/.test(s));
      expect(hasPremium, `Aucun libellé « Premium » trouvé dans ${name}`).toBe(
        true,
      );
    });
  }
});
