import { useSyncExternalStore } from "react";
import type { ThemePalette, TypeVariant } from "@/context/ThemeContext";

export type ThemePreviewState = {
  palette: ThemePalette | null;
  theme: "light" | "dark" | "mixed" | null;
  type: TypeVariant | null;
};

let state: ThemePreviewState = { palette: null, theme: null, type: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const themePreviewStore = {
  get: () => state,
  set: (patch: Partial<ThemePreviewState>) => {
    state = { ...state, ...patch };
    emit();
  },
  reset: () => {
    state = { palette: null, theme: null, type: null };
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useThemePreview(): ThemePreviewState {
  return useSyncExternalStore(themePreviewStore.subscribe, themePreviewStore.get, themePreviewStore.get);
}
