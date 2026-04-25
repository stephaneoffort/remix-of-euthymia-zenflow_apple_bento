import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { themePreviewStore, useThemePreview } from "@/lib/themePreviewStore";

let renderCount = 0;
function Probe() {
  renderCount++;
  const p = useThemePreview();
  return <div data-testid="probe">{p.palette ?? "none"}|{p.theme ?? "none"}|{p.type ?? "none"}</div>;
}

describe("useThemePreview - performance", () => {
  beforeEach(() => {
    themePreviewStore.reset();
    renderCount = 0;
  });

  it("ne re-render qu'une fois par appel set() distinct", () => {
    render(<Probe />);
    expect(renderCount).toBe(1);

    act(() => themePreviewStore.set({ palette: "bento-aurora" as any }));
    expect(renderCount).toBe(2);

    act(() => themePreviewStore.set({ theme: "dark" }));
    expect(renderCount).toBe(3);

    act(() => themePreviewStore.set({ type: "editorial" as any }));
    expect(renderCount).toBe(4);
  });

  it("100 updates rapides => 1 seul rendu groupé par batch React", () => {
    render(<Probe />);
    renderCount = 0;

    act(() => {
      for (let i = 0; i < 100; i++) {
        themePreviewStore.set({ theme: i % 2 === 0 ? "light" : "dark" });
      }
    });

    // Grâce au batching React 18 dans act(), un seul commit doit avoir lieu
    expect(renderCount).toBeLessThanOrEqual(1);
  });

  it("reset() après un set() => 2 rendus seulement", () => {
    render(<Probe />);
    renderCount = 0;

    act(() => themePreviewStore.set({ palette: "bento-aurora" as any }));
    act(() => themePreviewStore.reset());

    expect(renderCount).toBe(2);
  });

  it("ne re-render pas un composant non monté (cleanup)", () => {
    const { unmount } = render(<Probe />);
    unmount();
    renderCount = 0;
    act(() => themePreviewStore.set({ theme: "dark" }));
    expect(renderCount).toBe(0);
  });
});
