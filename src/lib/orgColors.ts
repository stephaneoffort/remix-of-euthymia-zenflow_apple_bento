import { TONE_ORDER, TONE_SOLID_HEX, TONE_LABELS } from './toneColor';

/**
 * Palette de couleurs d'équipe.
 * Reprend la palette douce commune (10 tons), un ton distinct par équipe possible.
 */
export const ORG_COLOR_PALETTE = TONE_ORDER.map((id) => ({
  value: TONE_SOLID_HEX[id],
  label: TONE_LABELS[id],
})) as ReadonlyArray<{ value: string; label: string }>;

/** Couleur de repli — ne devrait plus être nécessaire, conservée par sécurité. */
export const ORG_COLOR_FALLBACK = 'hsl(var(--primary))';

/**
 * Première couleur de la palette non encore utilisée par une équipe existante.
 * Évite que deux équipes partagent la même pastille par défaut.
 */
export function nextAvailableOrgColor(usedColors: (string | null | undefined)[]): string {
  const used = new Set(
    usedColors.filter(Boolean).map((c) => (c as string).trim().toLowerCase())
  );
  const free = ORG_COLOR_PALETTE.find((c) => !used.has(c.value.toLowerCase()));
  return (free ?? ORG_COLOR_PALETTE[0]).value;
}
