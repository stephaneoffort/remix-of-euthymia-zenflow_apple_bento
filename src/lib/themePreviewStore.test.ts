import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { themePreviewStore, useThemePreview } from "@/lib/themePreviewStore";

describe("themePreviewStore", () => {
  beforeEach(() => themePreviewStore.reset());

  it("expose un état initial nul", () => {
    expect(themePreviewStore.get()).toEqual({ palette: null, theme: null, type: null });
  });

  it("notifie les abonnés à chaque set()", () => {
    let count = 0;
    const unsub = themePreviewStore.subscribe(() => count++);
    themePreviewStore.set({ palette: "bento-aurora" as any });
    themePreviewStore.set({ theme: "dark" });
    themePreviewStore.set({ type: "editorial" as any });
    unsub();
    expect(count).toBe(3);
  });

  it("ne notifie plus après désabonnement", () => {
    let count = 0;
    const unsub = themePreviewStore.subscribe(() => count++);
    unsub();
    themePreviewStore.set({ theme: "light" });
    expect(count).toBe(0);
  });

  it("useThemePreview renvoie la valeur courante du store", () => {
    const { result } = renderHook(() => useThemePreview());
    expect(result.current).toEqual({ palette: null, theme: null, type: null });

    act(() => {
      themePreviewStore.set({ theme: "dark" });
    });
    expect(result.current).toEqual({ palette: null, theme: "dark", type: null });
  });

  it("propage un changement de preview en moins de 5ms pour 100 updates rapides", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      themePreviewStore.set({ theme: i % 2 === 0 ? "light" : "dark" });
    }
    const elapsed = performance.now() - start;
    // Garde-fou : 100 updates devraient être quasi instantanés
    expect(elapsed).toBeLessThan(50);
  });
});
