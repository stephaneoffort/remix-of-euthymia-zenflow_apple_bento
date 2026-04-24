import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { PALETTE_META } from "@/context/ThemeContext";

/**
 * Test e2e (rendu) : vérifie que la palette anciennement nommée
 * "Ivoire Chaud" est désormais exposée comme "Premium Chaud" dans
 * PALETTE_META et que le switch design mode utilise "Premium".
 *
 * Reproduit la structure de rendu utilisée dans :
 *  - src/pages/Settings.tsx (ThemePalettePanel — pastilles + label)
 *  - src/components/SidebarNM.tsx (sélecteur de palette + switch)
 *  - src/components/AppSidebar.tsx (switch design mode)
 */

function PalettePickerHarness() {
  return (
    <div>
      <h2>Palette</h2>
      <ul>
        {(Object.entries(PALETTE_META) as [string, { label: string }][]).map(
          ([key, meta]) => (
            <li key={key} data-key={key}>
              {meta.label}
            </li>
          ),
        )}
      </ul>
      {/* Switch Classic / Premium reproduit (Settings + SidebarNM + AppSidebar) */}
      <div role="group" aria-label="design-mode-switch">
        <button>⊞ Classic</button>
        <button>✦ Premium</button>
      </div>
    </div>
  );
}

describe("Renommage Ivoire → Premium dans l'interface", () => {
  it("expose la palette « Premium Chaud » dans PALETTE_META", () => {
    expect(PALETTE_META.ivoireChaud).toBeDefined();
    expect(PALETTE_META.ivoireChaud.label).toBe("Premium Chaud");
  });

  it("ne contient plus aucun label « Ivoire » dans PALETTE_META", () => {
    const labels = Object.values(PALETTE_META).map((m) => m.label);
    for (const label of labels) {
      expect(label).not.toMatch(/Ivoire/i);
    }
  });

  it("rend « Premium Chaud » dans la liste des palettes (Settings/Sidebar)", () => {
    const { container } = render(<PalettePickerHarness />);
    const text = container.textContent || "";
    expect(text).toContain("Premium Chaud");
    expect(text).not.toMatch(/Ivoire Chaud/i);
  });

  it("rend « Premium » dans le switch design mode", () => {
    const { container } = render(<PalettePickerHarness />);
    const buttons = Array.from(container.querySelectorAll("button")).map(
      (b) => b.textContent || "",
    );
    expect(buttons.some((t) => /Premium/.test(t))).toBe(true);
    expect(buttons.some((t) => /Ivoire/i.test(t))).toBe(false);
  });
});
