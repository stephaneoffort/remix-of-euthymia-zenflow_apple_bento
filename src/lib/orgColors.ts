/**
 * Palette de couleurs d'équipe.
 * Couleurs franchement différenciées, lisibles en thème clair comme en thème sombre.
 */
export const ORG_COLOR_PALETTE = [
  { value: '#F59E0B', label: 'Ambre' },
  { value: '#10B981', label: 'Émeraude' },
  { value: '#3B82F6', label: 'Bleu' },
  { value: '#E11D48', label: 'Rubis' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#F97316', label: 'Orange' },
  { value: '#84CC16', label: 'Vert lime' },
  { value: '#EC4899', label: 'Rose' },
  { value: '#64748B', label: 'Ardoise' },
] as const;

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
