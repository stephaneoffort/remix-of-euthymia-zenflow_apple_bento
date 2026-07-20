export type ReminderUnit = 'min' | 'h' | 'd';

export function parseReminderOffset(key: string): { amount: number; unit: ReminderUnit } {
  const match = key.match(/^(\d+)(min|h|d)$/);
  if (match) return { amount: parseInt(match[1], 10), unit: match[2] as ReminderUnit };
  return { amount: 1, unit: 'h' };
}

/** Format normalisé : "15 min", "2 h", "3 jours" (pluriel géré). */
export function formatReminderOffset(input: string | { amount: number; unit: ReminderUnit }): string {
  const { amount, unit } = typeof input === 'string' ? parseReminderOffset(input) : input;
  if (unit === 'min') return `${amount} min`;
  if (unit === 'h') return `${amount} h`;
  return `${amount} ${amount > 1 ? 'jours' : 'jour'}`;
}
